import * as fs from 'fs'

type EventHandler = (event: Event) => void;

function htmlEncode(input: string): string {
  return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
}

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

  logState() : void {
    console.log(`State: line=${this.currentLine}, word=${this.currentWord}, isBetween=${this.isBetween}, lastEnd=${this.lastEnd}`);
  }

  logWord(lineIndex: number, wordIndex: number) : void {
    const word: TranscriptWord = this.getWord(lineIndex, wordIndex);
    console.log(`Word: ${lineIndex}-${wordIndex} '${word.alternatives[0].content}' colour=${this.getBackgroundColor(lineIndex, wordIndex)}`)
  }

  protected loaded() : void {
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }

  // Set the transcript by passing in a TranscriptSchema object.  Useful for testing.
  load(transcript: TranscriptSchema) : void {
    this.transcript = transcript;
    this.loaded();
  }

  getUrl() : string {
      return this.transcript.url;
  }

  // Get the name of the speaker of the given line
  getSpeakerName(lineIndex: number = this.currentLine) : string {
    let speakerName: string = '';
    if (lineIndex >= 0 && lineIndex < this.transcript.lines.length) {
      const speakerIndex = this.transcript.lines[ lineIndex ].speaker;
      if (speakerIndex >= 0 && speakerIndex < this.transcript.speakers.length) {
        speakerName = this.transcript.speakers[speakerIndex];
      }
    }
    return speakerName;
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

  // Set the current line/word etc for the given time
  // Returns true if it was necessary to do a full search
  setCurrentTime(time: number) : boolean {
    if ( time < this.lastEnd || time > (this.lastEnd + 10) ){
      //console.log("Time shifted to " + time);
      this.lookupCurrentTime(time);
      return true;
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
    return false;
  }

  isCurrent(lineIndex: number, wordIndex: number) {
    return lineIndex == this.currentLine && this.currentWord == wordIndex;
  }

  getBackgroundColor(lineIndex: number, wordIndex: number) : string {
    const word = this.getWord(lineIndex, wordIndex);
    const confidence: number = word.alternatives[0].confidence;
    if ( word.start_time === undefined) {
      // punctuation has no confidence property
      return '';
    }
    else if (this.isCurrent(lineIndex, wordIndex))
      return "#FFFF33";
    else if (confidence > 0.9 ) {
      return '';
    }
    else if (confidence > 0.7 ) {
      return "#FFA566";
    }
    else {
      return "#FF8888";
    }
  }
}

export class ProofreadDom extends ProofreadTranscript {
  private prefix: string;
  
  constructor() {
    super();
    this.prefix = "ic";
  }

  secondsToHms(time: number): string {
    let from: number;
    if (time < 60*60){
      from = 14;
    }
    else if (time < 60*60*10) {
      from = 12;
    }
    else {
      from = 11;
    }

    return new Date(Math.floor(time) * 1000).toISOString().substring(from, 19)
  }

  // secondsToHms(time: number): string {
  //   let remainder: number = Math.floor(time);
  //   let timeHMS: string = "";
  //   while (remainder > 0 || timeHMS.length == 0) {
  //     let unit: number = remainder % 60;
  //     remainder = Math.floor(remainder / 60);
  //     timeHMS = (unit <= 9 ? "0" : "") + String(unit) + (timeHMS.length > 0 ? ":" + timeHMS : "");
  //   }
  //   return timeHMS;
  // }

  // Set the transcript by passing in the URL of a transcript file or a TranscriptSchema object.
  async load(transcript: string | TranscriptSchema) {
    if ( typeof transcript === "string") {
      // Load from URL using the DOM
      const response = await window.fetch(transcript);
      this.transcript = await response.json();
    }
    else {
      // Load from TranscriptSchema object
      super.load(transcript);
    }
    this.loaded();

    this.updateLine();

    // Set the transcript's audio url (if any) in the audio player (if any)
    const url: string = this.getUrl();
    if (url != '') {
      const audioElement = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
      if (audioElement) {
        audioElement.src = url;
      }
    }

    // Set the line select
    const selectElement: HTMLSelectElement | null = document.getElementById(this.prefix + "-select-line") as HTMLSelectElement;
    if ( selectElement ) {
      let html: string = "";
      for (let lineIndex = 0; lineIndex < this.transcript.lines.length; lineIndex++) {
        const offset: number = this.transcript.lines[lineIndex].words[0].start_time;
        html += `<option value="${offset}">${this.secondsToHms(offset)} ${htmlEncode(this.getSpeakerName(lineIndex))}</option>`;
      }
      selectElement.innerHTML = html;
    } 
  }
  
  attachButton(id: string, eventHandler: EventHandler) : void {
    // Setup the load button handler
    let element: HTMLElement | null = document.getElementById(this.prefix + id);
    if (element) {
      element.addEventListener("click", eventHandler);
    }    
  }

  attach(url: string | null, prefix: string = "ic") : void {
    this.prefix = prefix;
    let element: HTMLElement | null;

    // Load the audo first, so it can load asynchronously while the rest of the attaching happens
    element = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
    if ( element ) {
      element.addEventListener("timeupdate", this.handleTimeupdate);
      // Set url value, if provided
      if (url) {
        // Load the URL
        this.load(url);
      }
    }

    this.attachButton("-load", this.handleLoadButtonClick);
    this.attachButton("-skip-to-offset", this.handleSkipButtonClick);
    this.attachButton("-prev-line", this.handleLineButton);
    this.attachButton("-next-line", this.handleLineButton);

    // Set the URL in the URL edit box, if any
    if (url) {
      element = document.getElementById(prefix + "-transcript-url");
      if (element) {
        //console.log(`url=${url}`);
        (element as HTMLInputElement).value = url;
      }
    }

    // Set the select onchange handler
    element = document.getElementById(this.prefix + "-select-line") as HTMLSelectElement;
    if (element) {
      element.addEventListener("change", this.handleSelectLine);
    }
  }

  // The current line has changed. Update the UI accordingly
  updateLine() : void {
    let container: HTMLElement | null;
    //this.logState();

    // Set the speaker name in the speaker element, if any
    container = document.getElementById(this.prefix + '-speaker') as HTMLHtmlElement;
    if (container) {
      container.innerText = this.getSpeakerName();
    }

    // Set the current line in the line element
    container = document.getElementById(this.prefix + '-line');
    if (container) {
      const line: TranscriptLine = this.getCurrentLineWords();
      let html: string = '';
      let backgroundColor: string;
      for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
        let word: TranscriptWord = line.words[wordIndex];
        //console.log(`${this.currentLine}-${wordIndex} '${word.alternatives[0].content}' colour=${this.getBackgroundColor(this.currentLine, wordIndex)}`)
        backgroundColor = this.getBackgroundColor(this.currentLine, wordIndex);
        if (backgroundColor != "") {
          backgroundColor = ` style='background-color: ${backgroundColor}'`;
        }
        html += ( word.start_time !== undefined ? ' ' : '')
          + `<span id="${this.prefix}-word-${wordIndex}"${backgroundColor}>${htmlEncode(word.alternatives[0].content)}</span>`
      }
      container.innerHTML = html;
    }

    const selectElement: HTMLSelectElement | null = document.getElementById(this.prefix + "-select-line") as HTMLSelectElement;
    if (selectElement) {  
      selectElement.selectedIndex = this.currentLine;
    }
  }

  handleLoadButtonClick = async (event: Event) => {
    if (event.type === "click") {
      const el = document.getElementById(this.prefix + "-transcript-url") as HTMLInputElement;
      if (el) {
        await this.load(el.value);
      }
    }
  }

  setBackgroundColor(lineIndex: number, wordIndex: number) {
    const span = document.getElementById(this.prefix + "-word-" + String(wordIndex) ) as HTMLSpanElement;
    span.style.setProperty('background-color', this.getBackgroundColor(lineIndex, wordIndex), '');
  }

  setCurrentTime(currentTime : number) : boolean {
    const beforeMonlogueIndex = this.currentLine;
    const beforeWordIndex = this.currentWord;
    const beforeIssBetween = this.isBetween;

    //var timeAtStart = Date.now()
    const isSeek = super.setCurrentTime(currentTime);
    //var timeAfterSync = Date.now()

    if (beforeMonlogueIndex != this.currentLine ) {
      // The line has changed.
      // Update the displayed text.
      this.updateLine();
    }
    else if (beforeWordIndex != this.currentWord || beforeIssBetween != this.isBetween ) {
      // Moved to a different word in the same line.
      // Set the background colour
      this.setBackgroundColor(beforeMonlogueIndex, beforeWordIndex);
      this.setBackgroundColor(this.currentLine, this.currentWord);
    }
    //var timeAfterDom = Date.now()

    //if (isSeek) {
    //  console.log(`Sync took ${timeAfterSync-timeAtStart} and DOM took ${timeAfterDom-timeAtStart}`);
    //}
      
    return isSeek;
  }

  handleTimeupdate = async (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    const currentTime: number = audio.currentTime;
    this.setCurrentTime(currentTime);
  }

  skipTo(offset: number) {
    offset = isNaN(offset) ? 0 : offset;
    //console.log(`Skip to ${offset}`)
    const audioElement: HTMLAudioElement | null = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
    if (audioElement) {
      audioElement.currentTime = offset;
    }
  }

  handleSkipButtonClick = (event: Event) : void => {
    if (event.type === "click") {
      const offsetInput: HTMLInputElement | null = document.getElementById(this.prefix + "-offset") as HTMLInputElement;
      this.skipTo(parseInt(offsetInput?.value));
    }
  }

  handleSelectLine = (event: Event) : void => {
    const optionElement = event.target as HTMLOptionElement;
    this.skipTo(parseInt(optionElement?.value));
    //console.log(optionElement?.value);
  }

  handleLineButton = (event: Event) : void => {
    const buttonElement:HTMLElement | null  = event.target as HTMLElement;

    const lineIndex = this.currentLine + (buttonElement.id == this.prefix + "-prev-line" ? -1 : +1);
    if (lineIndex >= 0 && lineIndex < this.transcript.lines.length) {
      const word: TranscriptWord = this.getWord(lineIndex, 0);
      //console.log(`to line ${lineIndex}, starting at ${word.start_time}`);
      
      // Get the start time of the line's first word
      //const time = this.transcript.lines[selectElement.selectedIndex + (buttonElement.id == this.prefix + "-prev-line" ? -1 : +1)].words[0].start_time;
      //selectElement.selectedIndex = lineIndex + offset;
      this.skipTo(word.start_time);
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
