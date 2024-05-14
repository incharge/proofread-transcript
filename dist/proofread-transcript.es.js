/**
 * name: proofread-transcript
 * version: vv0.0.2-alpha.4
 * description: A UI component for proofreading and editing transcripts
 * author: Julian Price, inCharge Ltd
 * repository: git+https://github.com/incharge/proofread-transcript
 * build date: 2024-05-14T22:41:40.900Z 
 */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class ProofreadTranscript {
  constructor() {
    __publicField(this, "currentSection");
    __publicField(this, "currentWord");
    __publicField(this, "isBetween");
    __publicField(this, "lastEnd");
    //private hasChanged: boolean;
    __publicField(this, "transcript");
    __publicField(this, "getCurrentSectionWords", () => {
      if (this.currentSection < this.transcript.monologues.length) {
        return this.transcript.monologues[this.currentSection];
      } else {
        return { speaker: 0, items: [] };
      }
    });
    this.currentSection = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
    this.transcript = { url: "", speakers: [], monologues: [] };
  }
  loaded() {
    this.currentSection = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }
  async load(transcript) {
    if (typeof transcript === "string") {
      const response = await window.fetch(transcript);
      this.transcript = await response.json();
    } else {
      this.transcript = transcript;
    }
    this.loaded();
  }
  // import * as fs from 'fs'
  // loadFile(path: string) {
  //   this.transcript = JSON.parse(fs.readFileSync(path, 'utf-8'))
  //   this.loaded();
  //   console.log("Loaded " + String(this.transcript))
  // }
  getUrl() {
    return this.transcript.url;
  }
  getSpeaker() {
    let speaker = "";
    if (this.currentSection < this.transcript.monologues.length) {
      const speakerIndex = this.transcript.monologues[this.currentSection].speaker;
      if (speakerIndex < this.transcript.speakers.length) {
        speaker = this.transcript.speakers[speakerIndex];
      }
    }
    return speaker;
  }
  getWord(monologueIndex, wordIndex) {
    if (monologueIndex < this.transcript.monologues.length) {
      let monologue = this.transcript.monologues[monologueIndex];
      if (wordIndex < monologue.items.length)
        return monologue.items[wordIndex];
    }
    return { type: "", alternatives: [], start_time: 0, end_time: 0 };
  }
  getNextWordIndex(monologueIndex, wordIndex) {
    if (wordIndex >= this.transcript.monologues[monologueIndex].items.length - 1) {
      if (this.currentSection < this.transcript.monologues.length - 1) {
        monologueIndex++;
        wordIndex = 1;
      }
    } else {
      wordIndex++;
    }
    return [monologueIndex, wordIndex];
  }
  setCurrentTime(time) {
    if (time < this.lastEnd || time > this.lastEnd + 10) {
      console.log("Time shifted");
      return;
    }
    let word;
    let monologueIndex = this.currentSection;
    let wordIndex = this.currentWord;
    let isFound = false;
    do {
      word = this.getWord(monologueIndex, wordIndex);
      if (word.type == "pronunciation") {
        if (time <= word.end_time) {
          isFound = true;
          this.isBetween = time < word.start_time;
        }
      }
      if (isFound) {
        this.currentSection = monologueIndex;
        this.currentWord = wordIndex;
      } else {
        if (word.type == "pronunciation") {
          this.lastEnd = Number(word.end_time);
        }
        [monologueIndex, wordIndex] = this.getNextWordIndex(monologueIndex, wordIndex);
      }
    } while (!isFound);
  }
}
class ProofreadDom extends ProofreadTranscript {
  constructor() {
    super();
    __publicField(this, "prefix");
    __publicField(this, "handleLoadButtonClick", async (event) => {
      if (event.type === "click") {
        const el = document.getElementById(this.prefix + "-transcript-url");
        if (el) {
          await this.load(el.value);
          let container = document.getElementById(this.prefix + "-audio");
          container.src = this.getUrl();
          container.addEventListener("timeupdate", this.handleTimeupdate);
          this.updateLine();
        }
      }
    });
    __publicField(this, "handleTimeupdate", async (event) => {
      const audio = event.target;
      const currentTime = audio.currentTime;
      const beforeMonlogueIndex = this.currentSection;
      const beforeWordIndex = this.currentWord;
      const beforeIssBetween = this.isBetween;
      this.setCurrentTime(currentTime);
      if (beforeMonlogueIndex != this.currentSection) {
        this.updateLine();
      } else if (beforeWordIndex != this.currentWord || beforeIssBetween != this.isBetween) {
        let span = document.getElementById(this.prefix + "-word-" + String(beforeWordIndex));
        span.style.setProperty("background-color", "", "");
        if (!this.isBetween) {
          span = document.getElementById(this.prefix + "-word-" + String(this.currentWord));
          span.style.setProperty("background-color", "#FFFF00", "");
        }
      }
    });
    this.prefix = "pt";
  }
  attach(prefix = "pt") {
    this.prefix = prefix;
    const elButton = document.getElementById(prefix + "-load");
    if (elButton) {
      elButton.addEventListener("click", this.handleLoadButtonClick);
    }
  }
  updateLine() {
    let container;
    container = document.getElementById(this.prefix + "-speaker");
    container.innerText = this.getSpeaker();
    container = document.getElementById(this.prefix + "-line");
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const monologue = this.getCurrentSectionWords();
      for (let i = 0; i < monologue.items.length; i++) {
        let item = monologue.items[i];
        if (item.type == "pronunciation")
          container.innerHTML += " ";
        let span = document.createElement("span");
        span.textContent = item.alternatives[0].content;
        span.id = this.prefix + "-word-" + String(i);
        container.appendChild(span);
      }
    }
  }
}
export {
  ProofreadDom,
  ProofreadTranscript
};
