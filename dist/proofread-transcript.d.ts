declare module "proofread-transcript" {
    interface TranscriptAlternative {
        confidence: number;
        content: string;
    }
    interface TranscriptItem {
        type: string;
        alternatives: Array<TranscriptAlternative>;
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
        private transcript;
        constructor();
        private loaded;
        load(transcript: string | TranscriptSchema): Promise<void>;
        getUrl(): string;
        getSpeaker(): string;
        getCurrentSectionWords: () => TranscriptMonologues;
        getWord(monologueIndex: number, wordIndex: number): TranscriptItem;
        getNextWordIndex(monologueIndex: number, wordIndex: number): [number, number];
        setCurrentTime(time: number): void;
    }
}
