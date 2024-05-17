import { expect, test } from 'vitest';
import { ProofreadFilesystem, TranscriptSchema } from './proofread-transcript';

const testTranscript: TranscriptSchema = {
    url: "",
    speakers: ["Robin", "Charlie"],
    lines: [
      {
        speaker: 0,
        words: [
          {
            alternatives: [{
              confidence: 99,
              content: "Hello"
            }],
            start_time: 0.5,
            end_time: 1
          },
          {
            alternatives: [{
              confidence: 99,
              content: "there"
            }],
            start_time: 1.5,
            end_time: 2
          },
          {
            alternatives: [{
              confidence: 99,
              content: "."
            }],
            start_time: 0,
            end_time: 0
          }
        ]
      }
    ]
  }

class ProofreadTest extends ProofreadFilesystem {
    testState(lineIndex: number, wordIndex: number, isBetween: boolean): boolean {
        const isMatch: boolean = this.currentLine == lineIndex
        && this.currentWord == wordIndex
        && this.isBetween == isBetween;
        if (!isMatch) {
            this.logState();
        }
        return isMatch;
    }
}

test('Initial state', async () => {
    const proofreadTest = new ProofreadTest();

    // After construction, there's an empty transcript
    expect(proofreadTest.testState(0,0,true)).toBe(true);

    proofreadTest.load( testTranscript );
    // After loading, position is in the space before the first word
    expect(proofreadTest.testState(0,0,true)).toBe(true);

    // n seconds < between last and word n <= n+0.5 is on word n <= n+1
    // n+0.5 to n+0.5 is the space between the last word and word n
    proofreadTest.setCurrentTime(0.25);
    expect(proofreadTest.testState(0,0,true)).toBe(true);

    proofreadTest.setCurrentTime(0.5);
    expect(proofreadTest.testState(0,0,false)).toBe(true);

    proofreadTest.setCurrentTime(0.75);
    expect(proofreadTest.testState(0,0,false)).toBe(true);

    proofreadTest.setCurrentTime(1);
    expect(proofreadTest.testState(0,0,false)).toBe(true);

    proofreadTest.setCurrentTime(1.001);
    expect(proofreadTest.testState(0,1,true)).toBe(true);

    proofreadTest.setCurrentTime(1.499);
    expect(proofreadTest.testState(0,1,true)).toBe(true);

    proofreadTest.setCurrentTime(1.5);
    expect(proofreadTest.testState(0,1,false)).toBe(true);

    // https://incharge.github.io/thedissenter/transcript/924-icpt.json
    proofreadTest.load("test/924-icpt.json");
    proofreadTest.setCurrentTime(60);
  })
