import type { SourceDetail } from '@workspace/api-client-react';
import { question, type PracticeQuestion } from './testing';

export function buildApplied(source: SourceDetail): PracticeQuestion[] {
  const questions: PracticeQuestion[] = [];
  const add = (category: string, prompt: string, correct: string, distractors: string[], explanation: string, pattern: RegExp) => {
    const q = question(source, category, prompt, correct, distractors, explanation, pattern);
    if (q) questions.push(q);
  };
  const numbers = (answer: number) => [String(answer + 1), String(answer + 2), String(Math.max(0, answer - 1)), String(answer + 4)];

  if (source.id === 2 || source.id === 3) {
    for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) {
      const result = Number(Boolean(a && !b));
      add('Boolean expressions', `Practice variation: A = ${a}, B = ${b}. Evaluate A AND (NOT B).`,
        String(result), [String(1 - result)],
        `NOT B = ${1 - b}. AND produces 1 only when both its inputs are 1, so ${a} AND ${1 - b} = ${result}.`,
        source.id === 2 ? /conjunction \(AND\)/i : /circle on an input/i);
    }
    const expressions: [string, (a: number, b: number) => number][] = [
      ['A AND B', (a, b) => a & b],
      ['A OR B', (a, b) => a | b],
      ['NOT (A AND B)', (a, b) => 1 - (a & b)],
      ['A AND (NOT B)', (a, b) => a & (1 - b)],
    ];
    const rows = [[0, 0], [0, 1], [1, 0], [1, 1]];
    for (const [expression, evaluate] of expressions) {
      const outputs = rows.map(([a, b]) => evaluate(a!, b!)).join(', ');
      add('Truth tables',
        `Complete a truth table for ${expression}.\nRow order (A, B): (0,0), (0,1), (1,0), (1,1).\nWhich sequence gives the four outputs?`,
        outputs, ['0, 0, 0, 1', '0, 1, 1, 1', '1, 1, 1, 0', '0, 0, 1, 0'].filter(s => s !== outputs),
        `Evaluating ${expression} for each row in the given order produces ${outputs}.`,
        source.id === 2 ? /a truth table.*enumeration/i : /truth table/i);
    }
  }
  if (source.id === 3) {
    for (let sel = 0; sel <= 1; sel++) for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) {
      const result = sel ? b : a;
      add('Multiplexers', `Practice variation: a 2-input mux selects A when sel=0 and B when sel=1.\nA=${a}, B=${b}, sel=${sel}. What is the output?`,
        String(result), [String(1 - result)], `sel=${sel} selects ${sel ? 'B' : 'A'}, whose value is ${result}.`, /let.s call this other input "select"/i);
    }
  }
  if (source.id === 4) {
    for (const pins of [2, 3, 4, 5, 6, 8]) {
      const total = 2 ** pins;
      add('Test coverage', `Practice variation: a combinational circuit has ${pins} independent 1-bit inputs. How many rows are needed to exhaustively test all input combinations?`,
        String(total), numbers(total), `Each of ${pins} bits has 2 possible values. The number of combinations is 2^${pins} = ${total}.`, /four poss|all the possible inputs/i);
    }
    add('Truth tables', 'An exhaustive test of inputs A and B contains rows 00, 01, and 11. Which input row is missing?',
      '10', ['00', '01', '11'], 'Two independent input bits have four combinations: 00, 01, 10, 11.', /four poss|all the possible inputs/i);
  }
  if (source.id === 5) {
    for (const value of [3, 5, 6, 9, 10, 13]) {
      const bits = value.toString(2).padStart(4, '0');
      add('Binary integers', `Interpret ${bits} as an unsigned 4-bit integer. What is its decimal value?`,
        String(value), numbers(value), `The bit weights from left to right are 8, 4, 2, 1. ${bits} represents ${value}.`, /base.*2|2\^/i);
      const signed = value >= 8 ? value - 16 : value;
      add('Two’s complement', `Interpret ${bits} as a 4-bit two’s complement integer. What is its decimal value?`,
        String(signed), [String(signed + 1), String(signed - 1), String(signed + 16)],
        `The signed weights are −8, 4, 2, 1. ${value >= 8 ? `The unsigned value ${value} minus 16 is ${signed}.` : `The sign bit is 0, so the value is ${signed}.`}`, /two.s complement|two’s complement/i);
    }
  }
  if (source.id === 6) {
    for (const value of [10, 15, 26, 45, 60, 127, 165, 240]) {
      const hex = value.toString(16).toUpperCase().padStart(2, '0');
      const bits = value.toString(2).padStart(8, '0');
      add('Hexadecimal', `Convert the 8-bit binary number ${bits.slice(0, 4)} ${bits.slice(4)} to hexadecimal.`,
        `0x${hex}`, [value + 1, value + 16, value ^ 0xf].map(n => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`),
        `Group into nibbles. ${bits.slice(0, 4)} = ${hex[0]} and ${bits.slice(4)} = ${hex[1]}, giving 0x${hex}.`, /hexadecimal is particularly handy/i);
    }
  }
  if (source.id === 7) {
    for (const initial of [0, 1]) for (const data of [0, 1]) for (const edge of [true, false]) {
      const value = edge ? data : initial;
      add('Storage trace', `Practice variation: a rising-edge-triggered D flip-flop starts with Q=${initial}. D is set to ${data}. ${edge ? 'The clock rises from 0 to 1.' : 'The clock stays at 0; there is no rising edge.'} What is Q afterward?`,
        String(value), [String(1 - value)],
        edge ? `On the rising edge, Q captures D=${data}.` : `Without a rising edge, the flip-flop retains Q=${initial}.`, /this circuit is therefore "edge-triggered"/i);
    }
  }
  if (source.id === 8) {
    for (const count of [3, 4, 5, 8, 9, 16, 17, 32]) {
      const bits = Math.ceil(Math.log2(count));
      add('Memory addressing', `Practice variation: memory stores ${count} separately addressable registers. What is the minimum number of address bits?`,
        String(bits), numbers(bits), `${bits} bits encode 2^${bits} = ${2 ** bits} addresses, enough for ${count} registers. One fewer bit is insufficient.`, /how many bits do we need to identify/i);
    }
    for (const read of ['01', '10']) {
      const value = read === '01' ? '0101' : '1010';
      add('Memory trace', `Write 0101 to address 01 on a clock edge, then 1010 to address 10 on a later edge. No other writes occur. What value is read at address ${read}?`,
        value, ['0000', '1111', read === '01' ? '1010' : '0101'],
        `The writes affect separate registers. Address ${read} retains ${value}.`, /if I set write_addr to 01/i);
    }
  }
  if (source.id === 9) {
    for (const inputs of ['111', '1101', '10111', '0011', '1110', '100', '0111', '110']) {
      let state = 0;
      const trace = ['S0'];
      for (const bit of inputs) {
        state = bit === '0' ? 0 : Math.min(3, state + 1);
        trace.push(`S${state}`);
      }
      add('FSM tracing', `Practice variation (not the lecture’s missing diagram).\nStart in S0. On input 1: S0→S1, S1→S2, S2→S3, S3→S3. On input 0: every state→S0.\nConsume ${inputs.split('').join(', ')} from left to right. What is the final state?`,
        `S${state}`, ['S0', 'S1', 'S2', 'S3'].filter(s => s !== `S${state}`),
        `Apply one transition for each input: ${trace.join(' → ')}. The final state is S${state}.`, /decision of what state to go to next/i);
    }
  }
  if (source.id === 10) {
    const states = ['N/S red, E/W red', 'N/S green, E/W red', 'N/S yellow, E/W red', 'N/S red, E/W red', 'N/S red, E/W green', 'N/S red, E/W yellow'];
    for (let start = 0; start < 6; start++) {
      const ticks = start % 3 + 1;
      const next = (start + ticks) % 6;
      add('Traffic-light FSM', `The lecture’s light controller repeats states 0→1→2→3→4→5→0.\nStarting in state ${start}, advance ${ticks} state transition${ticks === 1 ? '' : 's'}. Which state and lights result?`,
        `State ${next}: ${states[next]}`,
        [1, 2, 3].map(offset => { const n = (next + offset) % 6; return `State ${n}: ${states[n]}`; }),
        `(${start} + ${ticks}) mod 6 = ${next}. In state ${next}, the lights are ${states[next]}. States 0 and 3 are both all-red.`, /start with N\/S red/i);
    }
  }
  return questions;
}
