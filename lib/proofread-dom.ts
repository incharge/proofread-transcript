import { ProofreadTranscript } from './proofread-transcript'

class ProofreadDom extends ProofreadTranscript {
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
export default ProofreadDom;
