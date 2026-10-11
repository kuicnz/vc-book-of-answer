"""Browser regression checks. Run: python3 tests/smoke.py (requires Playwright + Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class BookSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'TheBookOfAnswers')))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        cls.browser = cls.playwright.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        # The optional font service must not be a prerequisite for functional checks.
        self.context.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url, wait_until='load')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Unexpected JavaScript errors')

    def wait_open(self):
        self.page.wait_for_function("document.getElementById('bookButton').getAttribute('aria-expanded') === 'true'")

    def wait_closed(self):
        self.page.wait_for_function("!document.getElementById('actionButton').disabled && document.getElementById('bookButton').getAttribute('aria-expanded') === 'false'")

    def test_full_answer_cycle_and_translation_alignment(self):
        data = self.page.evaluate('window.BookAnswers')
        self.assertEqual(len(data), 120)
        for language in ['zh', 'en', 'ja']:
            self.assertEqual(len({answer[language] for answer in data}), 120)
        seen = set()
        for _ in range(120):
            self.page.locator('#actionButton').click()
            self.wait_open()
            index = int(self.page.locator('#pageNumber').inner_text()) - 1
            self.assertNotIn(index, seen)
            seen.add(index)
            self.assertEqual(self.page.locator('#answerText').inner_text(), data[index]['zh'])
            self.page.locator('#actionButton').click()
            self.wait_closed()
        self.page.locator('#actionButton').click()
        self.wait_open()
        next_index = int(self.page.locator('#pageNumber').inner_text()) - 1
        self.assertNotEqual(index, next_index, 'No repeat at the cycle boundary')
        for language, html_lang in [('en', 'en'), ('ja', 'ja'), ('zh', 'zh-CN')]:
            self.page.locator(f'[data-lang="{language}"]').click()
            self.assertEqual(self.page.locator('html').get_attribute('lang'), html_lang)
            self.assertEqual(self.page.locator('#answerText').inner_text(), data[next_index][language])
            self.assertEqual(int(self.page.locator('#pageNumber').inner_text()) - 1, next_index)

    def test_keyboard_again_and_preferences(self):
        self.page.keyboard.press('Space')
        self.wait_open()
        first = self.page.locator('#pageNumber').inner_text()
        self.page.locator('#againButton').click()
        self.wait_open()
        self.assertNotEqual(self.page.locator('#pageNumber').inner_text(), first)
        self.page.locator('#actionButton').press('Space')
        self.wait_closed()
        self.page.locator('[data-lang="en"]').click()
        self.page.locator('#soundToggle').press('Space')
        self.assertEqual(self.page.locator('#soundToggle').get_attribute('aria-pressed'), 'false')
        self.wait_closed()  # Space on controls must not also toggle the book.
        self.page.reload()
        self.assertEqual(self.page.locator('html').get_attribute('lang'), 'en')
        self.assertEqual(self.page.locator('#soundToggle').get_attribute('aria-pressed'), 'false')

    def test_responsive_layout_and_all_answer_lengths(self):
        for width, height in [(320,568), (375,812), (390,844), (768,1024), (1024,768), (1440,900), (1920,1080), (844,390)]:
            self.page.set_viewport_size({'width':width, 'height':height})
            for language in ['zh', 'en', 'ja']:
                self.page.locator(f'[data-lang="{language}"]').click()
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,language,'horizontal overflow'))
                self.page.locator('#actionButton').click()
                self.wait_open()
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,language,'open overflow'))
                # Exercise every translation in the actual styled answer element.
                overflows = self.page.evaluate('''language => {
                  const text = document.getElementById('answerText');
                  const content = document.querySelector('.answer-content');
                  const page = document.getElementById('answerPage');
                  const original = text.textContent;
                  const failures = window.BookAnswers.filter(answer => {
                    text.textContent = answer[language];
                    const children = [...content.children].map(el => el.getBoundingClientRect());
                    return content.scrollHeight > content.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1 ||
                      children[0].top < content.getBoundingClientRect().top - 1 ||
                      children.at(-1).bottom > content.getBoundingClientRect().bottom + 1 ||
                      page.scrollHeight > page.clientHeight + 1;
                  }).map(answer => answer[language]);
                  text.textContent = original;
                  return failures;
                }''', language)
                self.assertEqual(overflows, [], (width,language,overflows))
                self.page.locator('#actionButton').click()
                self.wait_closed()
        self.assertEqual(self.page.locator('.particle').count(), 0, 'Reduced motion disables particles')

    def test_animation_lock_and_sound_lifecycle(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.evaluate('''() => {
          window.audioStarts = 0;
          for (const type of [OscillatorNode, AudioBufferSourceNode]) {
            const start = type.prototype.start;
            type.prototype.start = function(...args) { window.audioStarts++; return start.apply(this, args); };
          }
        }''')
        # Use real pointer coordinates: the decorative floating animation never
        # becomes "stable" for Playwright's locator auto-wait.
        bounds = self.page.locator('#bookButton').bounding_box()
        self.page.mouse.click(bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2)
        self.assertTrue(self.page.locator('#actionButton').is_disabled())
        self.page.locator('[data-lang="ja"]').click()
        self.wait_open()
        self.assertGreater(self.page.evaluate('window.audioStarts'), 5)
        self.assertTrue(self.page.locator('#answerText').inner_text())
        self.page.locator('#soundToggle').click()
        before = self.page.evaluate('window.audioStarts')
        self.page.locator('#actionButton').click()
        self.wait_closed()
        self.page.locator('#actionButton').click()
        self.wait_open()
        self.assertEqual(self.page.evaluate('window.audioStarts'), before, 'Muted interactions schedule no sound')
        self.page.wait_for_function("document.querySelectorAll('.particle').length === 0")

    def test_storage_unavailable(self):
        self.page.add_init_script("Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error('storage disabled'); };")
        self.page.reload()
        self.page.locator('[data-lang="en"]').click()
        self.page.locator('#soundToggle').click()
        self.page.locator('#bookButton').click()
        self.wait_open()
        self.assertTrue(self.page.locator('#answerText').inner_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
