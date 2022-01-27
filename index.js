import puppeteer from "puppeteer";
import fs from "fs";

const filename = "words.txt";
const words = fs.readFileSync(filename, "utf8").split("\n");

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://www.powerlanguage.co.uk/wordle/");
  await page.waitForTimeout(400);

  console.log("finding answer...");

  const ans = await page.evaluate(
    (words) =>
      new Promise((resolve) => {
        // absent: -1
        // present: 5
        // correct: 0-4
        function checkInput(gameRow, map) {
          for (let i = 0; i < 5; i++) {
            const letter = gameRow
              .querySelectorAll("game-tile")
              [i].getAttribute("letter");

            // absent, present, correct
            const evaluation = gameRow
              .querySelectorAll("game-tile")
              [i].getAttribute("evaluation");

            let position =
              evaluation === "correct" ? i : evaluation === "present" ? 5 : -1;

            map.set(
              position,
              map.has(position) ? [...map.get(position), letter] : [letter]
            );
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
            const presentLetters = map.get(5);
            if (presentLetters) {
              filteredWords = filteredWords.filter((word) =>
                presentLetters.every((x) => word.indexOf(x) >= 0)
              );
            }
          }

          // filter absent letters
          if (filteredWords.length > 0) {
            const absentLetters = map.get(-1);
            if (absentLetters) {
              filteredWords = filteredWords.filter((word) =>
                absentLetters.every((x) => word.indexOf(x) === -1)
              );
            }
          }

          return filteredWords[0];
        }

        function keyin(word) {
          for (let i = 0; i < 5; i++) {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: word[i] })
            );
          }
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        }

        const appRoot = document.querySelector("game-app").shadowRoot;
        appRoot.querySelector("game-modal").click();

        const map = new Map();
        let availableChoice = "arise";

        for (let attempt = 0, done = false; attempt < 6 && !done; attempt++) {
          setTimeout(() => {
            keyin(availableChoice);

            const gameRow =
              appRoot.querySelectorAll("game-row")[attempt].shadowRoot;
            done = checkInput(gameRow, map);

            if (done) {
              let answer = "";
              for (let i = 0; i < 5; i++) {
                answer += map.get(i)[0];
              }
              resolve(answer);
            } else if (attempt === 5) {
              resolve("sorry, not found.");
            }

            availableChoice = getAvailableWord(map);
          }, 3000 * attempt);
        }
      }),
    words
  );

  console.log("Answer:", ans);

  await browser.close();
})();
