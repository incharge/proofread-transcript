// Do not combine a default export AND named exports in the same file
// because consumers of your bundle will have to use `my-bundle.default`
// to access the default export, which may not be what you want.
// Use `output.exports: "named"` to disable this warning.

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
  private transcript: TranscriptSchema;

  constructor() {
    //this.loaded();
    this.currentSection = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;

    //this.hasChanged = false;
    this.transcript = { url: "", speakers: [], monologues: [] };
  }

  private loaded() {
    this.currentSection = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }

  async load(transcript: string | TranscriptSchema) {
    if ( typeof transcript === "string") {
      const response = await window.fetch(transcript);
      this.transcript = await response.json();
    }
    else {
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

  getNextWordIndex(monologueIndex: number, wordIndex: number) : [ number, number ] {
    // Is the next word in the next monologue?
    if (wordIndex >= this.transcript.monologues[monologueIndex].items.length-1) {
      // On the last word
      if ( this.currentSection < this.transcript.monologues.length-1 ) {
        monologueIndex++;
        wordIndex = 1;
      }
      // else - Already on the last monologue
    }
    else {
      wordIndex++;
    }
    return [ monologueIndex, wordIndex ];
  }

  setCurrentTime(time: number) {
    if ( time < this.lastEnd || time > (this.lastEnd + 10) ){
      console.log("Time shifted");
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

  attach(prefix: string = "pt") {
    this.prefix = prefix;
    const elButton = document.getElementById(prefix + "-load");
    if (elButton) {
      elButton.addEventListener("click", this.handleLoadButtonClick)
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
}
