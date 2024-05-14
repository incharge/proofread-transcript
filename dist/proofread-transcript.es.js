/**
 * name: proofread-transcript
 * version: v0.0.2-alpha.1
 * description: A UI component for proofreading and editing transcripts
 * author: Julian Price, inCharge Ltd
 * repository: https://github.com/incharge/proofread-transcript
 * build date: 2024-05-14T15:42:00.706Z 
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
export {
  ProofreadTranscript
};
