import * as fs from 'fs'

interface TranscriptAlternative {
  confidence: number;
  content: string;
}

interface TranscriptItem {
  type: string;
  alternatives: Array<TranscriptAlternative>
  start_time: number;
  end_time: number;
}

interface TranscriptMonologues {
    speaker: number;
    items: Array<TranscriptItem>;
}

export interface TranscriptSchema {
  url: string;
  speakers: Array<string>;
  monologues: Array<TranscriptMonologues>;
}

export class ProofreadTranscript {
  protected currentSection: number;
  protected currentWord: number;
  protected isBetween: boolean;
  protected lastEnd: number;

  //private hasChanged: boolean;
  protected transcript: TranscriptSchema;

  constructor() {
    //this.loaded();
    this.currentSection = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;

    //this.hasChanged = false;
    this.transcript = { url: "", speakers: [], monologues: [] };
  }

  showState() {
    console.log("line=" + String(this.currentSection) + ", word=" + String(this.currentWord) + ", isBetween=" + String(this.isBetween) + ", laseEnd=" + this.lastEnd);
  }

  protected loaded() {
    this.currentSection = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }

  load(transcript: TranscriptSchema) {
    this.transcript = transcript;
    this.loaded();
  }

  getUrl() {
      return this.transcript.url;
  }

  getSpeaker() {
    let speaker: string = '';
    if (this.currentSection < this.transcript.monologues.length) {
      const speakerIndex = this.transcript.monologues[ this.currentSection ].speaker;
      if (speakerIndex < this.transcript.speakers.length) {
        speaker = this.transcript.speakers[speakerIndex];
      }
    }
    return speaker;
  }

  getCurrentSectionWords = () : TranscriptMonologues => {
    if (this.currentSection < this.transcript.monologues.length) {
      return this.transcript.monologues[this.currentSection];
    }
    else {
      return { speaker: 0, items: [] };
    }
  }

  getWord(monologueIndex: number, wordIndex: number) : TranscriptItem {
    if (monologueIndex < this.transcript.monologues.length) {
      let monologue = this.transcript.monologues[monologueIndex];
      if (wordIndex < monologue.items.length)
        return monologue.items[wordIndex];
    }
    return { type: "", alternatives: [], start_time: 0, end_time: 0 }
  }

  getPreviousWordIndex(monologueIndex: number, wordIndex: number) : [ number, number ] {
    // Is the previous word in the previous monologue?
    if (wordIndex == 0) {
      // On the first word
      if ( monologueIndex > 0 ) {
        monologueIndex--;
        wordIndex = this.transcript.monologues[monologueIndex].items.length-1;
      }
      // else - Already on the first word of the first monologue
    }
    else {
      wordIndex--;
    }
    return [ monologueIndex, wordIndex ];
  }

  getPreviousEndTime(monologueIndex: number, wordIndex: number) {
    let word: TranscriptItem;
    do {
      [ monologueIndex, wordIndex ] = this.getPreviousWordIndex(monologueIndex, wordIndex);
      word = this.getWord(monologueIndex, wordIndex);
    } while (word.end_time === undefined);
    return word.end_time;
  }

  getNextWordIndex(monologueIndex: number, wordIndex: number) : [ number, number ] {
    // Is the next word in the next monologue?
    if (wordIndex >= this.transcript.monologues[monologueIndex].items.length-1) {
      // On the last word
      if ( this.currentSection < this.transcript.monologues.length-1 ) {
        monologueIndex++;
        wordIndex = 1;
      }
      // else - Already on the last word of the last monologue
    }
    else {
      wordIndex++;
    }
    return [ monologueIndex, wordIndex ];
  }

  rewindToWord(monologue: TranscriptMonologues, wordIndex: number) {
    while (monologue.items[wordIndex].end_time === undefined && wordIndex > 0) {
      wordIndex--;
    }
    return wordIndex;
  }
  forwardToWord(monologue: TranscriptMonologues, wordIndex: number) {
    while (monologue.items[wordIndex].end_time === undefined && wordIndex < monologue.items.length) {
      wordIndex++;
    }
    return wordIndex;
  }

  lookupCurrentTime(time: number) {
    let lowIndex: number = 0;
    let highIndex: number = this.transcript.monologues.length - 1;
    let middleIndex : number;
    let monologue: TranscriptMonologues | undefined;
    // let word: TranscriptItem;

    if (lowIndex > highIndex)
      return;

    // Find the line containing time
    while (lowIndex != highIndex) {
      middleIndex = Math.floor((lowIndex + highIndex) / 2);
      monologue = this.transcript.monologues[middleIndex];
      let wordIndex = this.rewindToWord(monologue, monologue.items.length-1);
      if ( time > monologue.items[wordIndex].end_time ) {
        lowIndex = middleIndex + 1;
      }
      else {
        highIndex = middleIndex;
      }
    }
    this.currentSection = lowIndex;

    // Find the word containing time
    if (monologue == undefined) {
      monologue = this.transcript.monologues[lowIndex];
    }
    lowIndex = 0;
    highIndex = this.rewindToWord(monologue, monologue.items.length - 1);
    if (lowIndex > highIndex)
      return;

    while (lowIndex != highIndex) {
      middleIndex = this.rewindToWord(monologue, Math.floor((lowIndex + highIndex) / 2));;
      if ( time > monologue.items[middleIndex].end_time ) {
        lowIndex = this.forwardToWord(monologue, middleIndex + 1);
      }
      else {
        highIndex = middleIndex;
      }
    }
    this.currentWord = lowIndex;
    this.isBetween = time < monologue.items[lowIndex].start_time;
    this.lastEnd = this.getPreviousEndTime(this.currentSection, this.currentWord);
    this.showState();
  }

  setCurrentTime(time: number) {
    if ( time < this.lastEnd || time > (this.lastEnd + 10) ){
      //console.log("Time shifted to " + time);
      this.lookupCurrentTime(time);
      return;
    }

    let word: TranscriptItem;
    let monologueIndex: number = this.currentSection;
    let wordIndex: number = this.currentWord;
    let isFound: boolean = false;
    do {
        word = this.getWord(monologueIndex, wordIndex);
        if ( word.type == "pronunciation" ) {
          if ( time <= word.end_time ) {
            isFound = true;
            this.isBetween = time < word.start_time;
          }
        }

        if ( isFound ) {
          this.currentSection = monologueIndex;
          this.currentWord = wordIndex;
        }
        else {
          if ( word.type == "pronunciation" ) {
            this.lastEnd = Number(word.end_time);
          }
          [monologueIndex, wordIndex] = this.getNextWordIndex(monologueIndex, wordIndex);
        }
    } while (!isFound);

    //console.log("1 Time=" + String(time) + ", line=" + String(this.currentSection) + ", Word=" + String(this.currentWord) + ", isBetween=" + String(this.isBetween));
  }
}

export class ProofreadDom extends ProofreadTranscript {
  private prefix: string;
  
  constructor() {
    super();
    this.prefix = "pt";
  }

  async load(transcript: string | TranscriptSchema) {
    if ( typeof transcript === "string") {
      const response = await window.fetch(transcript);
      this.transcript = await response.json();
    }
    else {
      super.load(transcript);
    }
    this.loaded();
  }

  attach(prefix: string = "pt") {
    this.prefix = prefix;
    let element: HTMLElement | null;
    element = document.getElementById(prefix + "-load");
    if (element) {
      element.addEventListener("click", this.handleLoadButtonClick)
    }    

    element = document.getElementById(prefix + "-skip");
    if (element) {
      element.addEventListener("click", this.handleSkipButtonClick)
    }    
  }

  updateLine() {
    let container;

    container = document.getElementById(this.prefix + '-speaker') as HTMLHtmlElement;
    container.innerText = this.getSpeaker();

    container = document.getElementById(this.prefix + '-line');
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const monologue = this.getCurrentSectionWords();
      for (let i = 0; i < monologue.items.length; i++) {
        let item = monologue.items[i];
        if (item.type == 'pronunciation')
          container.innerHTML += ' ';
        let span = document.createElement('span');
        span.textContent = item.alternatives[0].content;
        span.id = this.prefix + '-word-' + String(i);
        container.appendChild(span);
      }
    }
  }

  handleLoadButtonClick = async (event: Event) => {
    if (event.type === "click") {
      const el = document.getElementById(this.prefix + "-transcript-url") as HTMLInputElement;
      if (el) {
        await this.load(el.value);
        let container = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
        container.src = this.getUrl();
        container.addEventListener("timeupdate", this.handleTimeupdate);

        this.updateLine();
      }
    }
  }

  handleTimeupdate = async (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    const currentTime: number = audio.currentTime;

    const beforeMonlogueIndex = this.currentSection;
    const beforeWordIndex = this.currentWord;
    const beforeIssBetween = this.isBetween;

    this.setCurrentTime(currentTime);
    if (beforeMonlogueIndex != this.currentSection ) {
      this.updateLine();
    }
    else if (beforeWordIndex != this.currentWord || beforeIssBetween != this.isBetween ) {
      let span = document.getElementById(this.prefix + "-word-" + String(beforeWordIndex) ) as HTMLSpanElement;
      span.style.setProperty('background-color','','');

      if (!this.isBetween) {
        span = document.getElementById(this.prefix + "-word-" + String(this.currentWord) ) as HTMLSpanElement;
        span.style.setProperty('background-color','#FFFF00','');
        //console.log( "Updated Time=" + String(audio.currentTime) + ", Line=" + String(this.currentSection)  + ", Word=" + String(this.currentWord)   + ", isBetween=" + String(this.isBetween) + ", word=" + span.innerText + ", LastEnd=" + String(this.lastEnd)  );
      }
    }
  }

  handleSkipButtonClick = (event: Event) => {
    if (event.type === "click") {
      const audio = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
      audio.currentTime =60;
    }
  }
}

export class ProofreadFilesystem extends ProofreadTranscript {
  load(transcript: string | TranscriptSchema) {
    if ( typeof transcript === "string") {
      this.transcript = JSON.parse(fs.readFileSync(transcript, 'utf-8'));
      this.loaded();
    }
    else {
      super.load(transcript);
    }
  }    
}
