import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';

const app = express();

const filename = 'words.txt';
const words = fs.readFileSync(filename, 'utf8').split('\n');

const getAnswer = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  await page.goto('https://www.nytimes.com/games/wordle/index.html');
  await page.waitForTimeout(400);

  console.log('finding answer...');

  const ans = await page.evaluate(
    (words) =>
      new Promise((resolve) => {
        // absent: -1
        // present: 5
        // correct: 0-4

        function checkInput(gameRow, map) {
          for (let i = 0; i < 5; i++) {
            const letter = gameRow
              .querySelectorAll('div[class^="Tile-module_tile"]')
              [i].innerText.toLowerCase();

            // absent, present, correct
            const evaluation = gameRow
              .querySelectorAll('div[class^="Tile-module_tile"]')
              [i].getAttribute('data-state');

            if (evaluation === 'correct') {
              if (!map.has(i)) {
                map.set(i, [letter]);
              }
            } else if (evaluation === 'present') {
              map.set(letter, map.has(letter) ? [...map.get(letter), i] : [i]);
            } else if (evaluation === 'absent') {
              map.set(-1, map.has(-1) ? [...map.get(-1), letter] : [letter]);
            }
          }

          let hasCorrectAnswer = true;
          for (let i = 0; i < 5; i++) {
            if (!map.get(i)) {
              hasCorrectAnswer = false;
            }
          }
          return hasCorrectAnswer;
        }

        function getAvailableWord(map) {
          let filteredWords = [...words];

          // filter correct letters
          for (let i = 0; i < 5; i++) {
            if (map.get(i) && map.get(i)[0]) {
              filteredWords = filteredWords.filter((word) => {
                return map.get(i)[0] === word[i];
              });
            }
          }

          // filter present letters
          if (filteredWords.length > 0) {
            [
              'a',
              'b',
              'c',
              'd',
              'e',
              'f',
              'g',
              'h',
              'i',
              'j',
              'k',
              'l',
              'm',
              'n',
              'o',
              'p',
              'q',
              'r',
              's',
              't',
              'u',
              'v',
              'w',
              'x',
              'y',
              'z',
            ].map((letter) => {
              const incorrectPosArr = map.get(letter);
              if (incorrectPosArr) {
                filteredWords = filteredWords.filter((word) =>
                  incorrectPosArr.every(
                    (pos) =>
                      word.indexOf(letter) >= 0 && word.indexOf(letter) !== pos
                  )
                );
              }
            });
          }

          // filter absent letters
          if (filteredWords.length > 0) {
            const absentLetters = map.get(-1);
            if (absentLetters) {
              filteredWords = filteredWords.filter((word) =>
                absentLetters.every((letter) => {
                  let hasCorrectOcc = false;

                  [...map.entries()].some(([key, values]) => {
                    if (key !== -1 && values.some((v) => v === letter)) {
                      hasCorrectOcc = true;
                    }
                  });

                  if (hasCorrectOcc) {
                    return word.indexOf(letter) === word.lastIndexOf(letter);
                  }

                  return word.indexOf(letter) === -1;
                })
              );
            }
          }

          // console.log('map', map);
          // console.log('filteredWords', filteredWords);

          return filteredWords[0];
        }

        function keyin(word) {
          for (let i = 0; i < 5; i++) {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: word[i] })
            );
          }
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        }

        const appRoot = document.querySelector('#wordle-app-game');
        const map = new Map();
        let availableChoice = 'arise';

        for (let attempt = 0, done = false; attempt < 6 && !done; attempt++) {
          setTimeout(() => {
            if (attempt !== 0) {
              const gameRow = appRoot.querySelectorAll(
                'div[class^="Row-module_row"]'
              )[attempt - 1];

              done = checkInput(gameRow, map);

              if (done) {
                let answer = '';
                for (let i = 0; i < 5; i++) {
                  answer += map.get(i)[0];
                }
                resolve(answer);
              } else if (attempt == 5) {
                resolve('sorry, not found.');
              }

              availableChoice = getAvailableWord(map);
            }

            keyin(availableChoice);
          }, 3000 * attempt);
        }
      }),
    words
  );

  await browser.close();

  console.log('Answer:', ans);
  return ans;
};

app.get('/', async (req, res) => {
  // allow access from other domains
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');

  const answer = await getAnswer();

  // return a JSON object as a response
  res.status(200).json({ answer });
});

// start app
const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('listening on port ' + port);
});
