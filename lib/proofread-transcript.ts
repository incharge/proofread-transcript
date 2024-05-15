import * as fs from 'fs'

interface TranscriptAlternative {
  confidence: number;
  content: string;
}

interface TranscriptWord {
  alternatives: Array<TranscriptAlternative>
  start_time: number;
  end_time: number;
}

interface TranscriptLine {
    speaker: number;
    words: Array<TranscriptWord>;
}

export interface TranscriptSchema {
  url: string;
  speakers: Array<string>;
  lines: Array<TranscriptLine>;
}

export class ProofreadTranscript {
  protected currentLine: number;
  protected currentWord: number;
  protected isBetween: boolean;
  protected lastEnd: number;

  //private hasChanged: boolean;
  protected transcript: TranscriptSchema;

  constructor() {
    //this.loaded();
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;

    //this.hasChanged = false;
    this.transcript = { url: "", speakers: [], lines: [] };
  }

  showState() : void {
    console.log("line=" + String(this.currentLine) + ", word=" + String(this.currentWord) + ", isBetween=" + String(this.isBetween) + ", laseEnd=" + this.lastEnd);
  }

  protected loaded() : void {
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }

  load(transcript: TranscriptSchema) : void {
    this.transcript = transcript;
    this.loaded();
  }

  getUrl() : string {
      return this.transcript.url;
  }

  getSpeaker() : string {
    let speaker: string = '';
    if (this.currentLine < this.transcript.lines.length) {
      const speakerIndex = this.transcript.lines[ this.currentLine ].speaker;
      if (speakerIndex < this.transcript.speakers.length) {
        speaker = this.transcript.speakers[speakerIndex];
      }
    }
    return speaker;
  }

  getCurrentLineWords = () : TranscriptLine => {
    if (this.currentLine < this.transcript.lines.length) {
      return this.transcript.lines[this.currentLine];
    }
    else {
      return { speaker: 0, words: [] };
    }
  }

  getWord(lineIndex: number, wordIndex: number) : TranscriptWord {
    if (lineIndex < this.transcript.lines.length) {
      let line = this.transcript.lines[lineIndex];
      if (wordIndex < line.words.length)
        return line.words[wordIndex];
    }
    return { alternatives: [], start_time: 0, end_time: 0 }
  }

  getPreviousWordIndex(lineIndex: number, wordIndex: number) : [ number, number ] {
    // Is the previous word in the previous line?
    if (wordIndex == 0) {
      // On the first word
      if ( lineIndex > 0 ) {
        lineIndex--;
        wordIndex = this.transcript.lines[lineIndex].words.length-1;
      }
      // else - Already on the first word of the first line
    }
    else {
      wordIndex--;
    }
    return [ lineIndex, wordIndex ];
  }

  getPreviousEndTime(lineIndex: number, wordIndex: number) : number {
    let word: TranscriptWord;
    do {
      [ lineIndex, wordIndex ] = this.getPreviousWordIndex(lineIndex, wordIndex);
      word = this.getWord(lineIndex, wordIndex);
    } while (word.end_time === undefined);
    return word.end_time;
  }

  getNextWordIndex(lineIndex: number, wordIndex: number) : [ number, number ] {
    // Is the next word in the next line?
    if (wordIndex >= this.transcript.lines[lineIndex].words.length-1) {
      // On the last word
      if ( this.currentLine < this.transcript.lines.length-1 ) {
        lineIndex++;
        wordIndex = 0;
      }
      // else - Already on the last word of the last line
    }
    else {
      wordIndex++;
    }
    return [ lineIndex, wordIndex ];
  }

  rewindToWord(line: TranscriptLine, wordIndex: number) : number {
    while (line.words[wordIndex].end_time === undefined && wordIndex > 0) {
      wordIndex--;
    }
    return wordIndex;
  }
  forwardToWord(line: TranscriptLine, wordIndex: number) : number {
    while (line.words[wordIndex].end_time === undefined && wordIndex < line.words.length) {
      wordIndex++;
    }
    return wordIndex;
  }

  lookupCurrentTime(time: number) : void {
    let lowIndex: number = 0;
    let highIndex: number = this.transcript.lines.length - 1;
    let middleIndex : number;
    let line: TranscriptLine | undefined;
    // let word: TranscriptWord;

    if (lowIndex > highIndex)
      return;
    
    // Find the line containing time
    while (lowIndex != highIndex) {
      middleIndex = Math.floor((lowIndex + highIndex) / 2);
      line = this.transcript.lines[middleIndex];
      let wordIndex = this.rewindToWord(line, line.words.length-1);
      if ( time > line.words[wordIndex].end_time ) {
        lowIndex = middleIndex + 1;
      }
      else {
        highIndex = middleIndex;
      }
    }
    this.currentLine = lowIndex;

    // Find the word containing time
    line = this.transcript.lines[this.currentLine];
    lowIndex = 0;
    highIndex = this.rewindToWord(line, line.words.length - 1);
    if (lowIndex > highIndex)
      return;

    while (lowIndex != highIndex) {
      middleIndex = this.rewindToWord(line, Math.floor((lowIndex + highIndex) / 2));;
      if ( time > line.words[middleIndex].end_time ) {
        lowIndex = this.forwardToWord(line, middleIndex + 1);
      }
      else {
        highIndex = middleIndex;
      }
    }
    this.currentWord = lowIndex;
    this.isBetween = time < line.words[lowIndex].start_time;
    this.lastEnd = this.getPreviousEndTime(this.currentLine, this.currentWord);
  }

  setCurrentTime(time: number) : void {
    if ( time < this.lastEnd || time > (this.lastEnd + 10) ){
      //console.log("Time shifted to " + time);
      this.lookupCurrentTime(time);
      return;
    }

    let word: TranscriptWord;
    let lineIndex: number = this.currentLine;
    let wordIndex: number = this.currentWord;
    let isFound: boolean = false;
    do {
        word = this.getWord(lineIndex, wordIndex);
        if ( word.end_time !== undefined ) {
          if ( time <= word.end_time ) {
            isFound = true;
            this.isBetween = time < word.start_time;
          }
        }

        if ( isFound ) {
          this.currentLine = lineIndex;
          this.currentWord = wordIndex;
        }
        else {
          if ( word.end_time !== undefined ) {
            this.lastEnd = word.end_time;
          }
          [lineIndex, wordIndex] = this.getNextWordIndex(lineIndex, wordIndex);
        }
    } while (!isFound);
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

  attach(prefix: string = "pt") : void {
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

  updateLine() : void {
    let container;

    container = document.getElementById(this.prefix + '-speaker') as HTMLHtmlElement;
    container.innerText = this.getSpeaker();

    container = document.getElementById(this.prefix + '-line');
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const line = this.getCurrentLineWords();
      for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
        let word = line.words[wordIndex];
        if (word.start_time !== undefined)
          container.innerHTML += ' ';
        let span = document.createElement('span');
        span.textContent = word.alternatives[0].content;
        span.id = this.prefix + '-word-' + String(wordIndex);
        span.style.setProperty('background-color', this.getBackgroundColor(this.currentLine, wordIndex),'');
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

  getBackgroundColor(lineIndex: number, wordIndex: number) : string {
    const word = this.getWord(lineIndex, wordIndex);
    const confidence: number = word.alternatives[0].confidence;
    if ( word.start_time === undefined || this.isBetween) {
      // punctuation has no confidenct
      return '';
    }
    else if ( this.isCurrent(lineIndex, wordIndex) )
      return "#FFFF00";
    else if (confidence > 0.9 ) {
      return '';
    }
    else if (confidence > 0.7 ) {
      return "#FFA500";
    }
    else {
      return "#FF0000";
    }
  }

  isCurrent(lineIndex: number, wordIndex: number) {
    return lineIndex == this.currentLine && this.currentWord == wordIndex;
  }

  setBackgroundColor(lineIndex: number, wordIndex: number) {
    const span = document.getElementById(this.prefix + "-word-" + String(wordIndex) ) as HTMLSpanElement;
    span.style.setProperty('background-color', this.getBackgroundColor(lineIndex, wordIndex), '');
  }

  setCurrentTime(currentTime : number) {
    const beforeMonlogueIndex = this.currentLine;
    const beforeWordIndex = this.currentWord;
    const beforeIssBetween = this.isBetween;

    super.setCurrentTime(currentTime);

    if (beforeMonlogueIndex != this.currentLine ) {
      // The line has changed
      this.updateLine();
    }
    else if (beforeWordIndex != this.currentWord || beforeIssBetween != this.isBetween ) {
      this.setBackgroundColor(beforeMonlogueIndex, beforeWordIndex);
      //this.isBetween ?
      this.setBackgroundColor(this.currentLine, this.currentWord);
    }
  }

  handleTimeupdate = async (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    const currentTime: number = audio.currentTime;
    this.setCurrentTime(currentTime);
  }

  handleSkipButtonClick = (event: Event) : void => {
    if (event.type === "click") {
      const audio = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
      audio.currentTime =60;
    }
  }
}

export class ProofreadFilesystem extends ProofreadTranscript {
  load(transcript: string | TranscriptSchema) : void {
    if ( typeof transcript === "string") {
      this.transcript = JSON.parse(fs.readFileSync(transcript, 'utf-8'));
      this.loaded();
    }
    else {
      super.load(transcript);
    }
  }    
}
