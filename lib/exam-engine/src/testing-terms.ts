import type { SourceDetail } from '@workspace/api-zod';
import { question, type PracticeQuestion } from './testing';

type Term = [string, string, string[], RegExp];
const terms: Record<number, Term[]> = {
  2: [
    ['Which operation is conjunction?', 'AND', ['OR', 'NOT', 'XOR'], /conjunction \(AND\)/i],
    ['When does XOR produce 1?', 'Exactly one of its two inputs is 1.', ['Both inputs are 1.', 'Both inputs are 0.', 'At least one input is 1, including both.'], /exclusive.?or|XOR/i],
    ['What does a truth table enumerate?', 'All input combinations and their corresponding outputs.', ['Only the inputs producing 1.', 'The transistor voltages over time.', 'Only invalid inputs.'], /a truth table.*enumeration/i],
  ],
  3: [
    ['What is a multiplexer used for?', 'Selecting one of several input values as the output.', ['Storing the previous output.', 'Adding all input values.', 'Converting a clock to a voltage.'], /we want this circuit to allow us to choose/i],
    ['What does a little circle on a logic gate pin mean?', 'Negation (inversion).', ['Stored state.', 'Addition.', 'A rising clock edge.'], /a circle on an input/i],
    ['What characterizes combinational logic?', 'Its output depends on the current inputs, not stored history.', ['Its output must depend on a previous state.', 'It requires a clock for every output change.', 'It always has exactly two inputs.'], /for a circuit that doesn.t remember/i],
  ],
  4: [
    ['Why explicitly enumerate circuit test inputs?', 'To avoid forgetting or skipping possible input combinations.', ['To make a circuit store its output.', 'To eliminate the need for expected outputs.', 'To prove correctness by testing only one case.'], /easy to forget or skip/i],
    ['What belongs on the first line of a Logisim test file?', 'Input and output labels separated by spaces.', ['Only output values.', 'A drawing of the circuit.', 'The number of clock ticks.'], /first line must be a list/i],
  ],
  5: [
    ['In positional binary, successive places have what weights?', 'Powers of 2.', ['Powers of 10.', 'All weights are 1.', 'Successive prime numbers.'], /base.*2|2\^|powers of two/i],
    ['What is integer overflow?', 'A mathematical result outside the range representable by the available bits.', ['An input wire that is floating.', 'Any negative result.', 'Any carry between adjacent bit positions.'], /we call this "overflow"/i],
    ['Which representation is used for signed integers in this lecture?', 'Two’s complement.', ['ASCII.', 'Unsigned magnitude only.', 'IEEE 754 only.'], /two.s complement|two’s complement/i],
  ],
  6: [
    ['How many bits correspond to one hexadecimal digit?', '4', ['2', '8', '16'], /four|4 bit|4-bit/i],
    ['What does ASCII encode?', 'Characters as numeric codes.', ['Only fractional numbers.', 'Logic gate timing.', 'Memory addresses only.'], /arbitrarily assign letters to bit sequences/i],
    ['What is a limitation of finite-precision floating point?', 'Some real numbers cannot be represented exactly.', ['It can represent every real number exactly.', 'It cannot represent any negative value.', 'It uses an unlimited number of bits.'], /IEEE 754 has undeniable limitations/i],
  ],
  7: [
    ['What distinguishes storage elements from combinational logic?', 'They retain state.', ['They always output 0.', 'They only invert inputs.', 'They have no inputs.'], /stor|remember|state/i],
    ['When does a rising-edge-triggered D flip-flop capture its input?', 'When the clock changes from 0 to 1.', ['Throughout every high clock level.', 'Only when the data changes.', 'When the clock changes from 1 to 0.'], /this circuit is therefore "edge-triggered"/i],
  ],
  8: [
    ['What does a memory address identify?', 'A particular storage location.', ['The current clock voltage.', 'The operation of an AND gate.', 'Only the value being written.'], /address/i],
    ['What does byte-addressable mean?', 'Each address refers to one byte.', ['Each address refers to one bit.', 'An address is always 8 bits wide.', 'Memory can store only characters.'], /byte.addressable/i],
    ['Which component selects a stored register’s value for a memory read?', 'A multiplexer.', ['A NOT gate alone.', 'A power supply.', 'An ASCII encoder.'], /whenever you think about choice/i],
  ],
  9: [
    ['What determines the next state in a sequential circuit?', 'The current state and input, through combinational logic.', ['Only the wire color.', 'Only the total number of registers.', 'No previous state or input.'], /decision of what state to go to next/i],
    ['What does an FSM transition describe?', 'A move from one state to another under a condition.', ['A permanent loss of all inputs.', 'A conversion from binary to ASCII.', 'The numeric value of a transistor voltage.'], /transitions: what makes/i],
    ['Why does the ordered combination lock need stored state?', 'To remember progress through the sequence.', ['To avoid ever reading an input.', 'To make every input open the lock.', 'To convert every digit to floating point.'], /remember.*where we are/i],
  ],
  10: [
    ['What drives transitions in the lecture’s traffic-light sequence?', 'Time, rather than an external combination input.', ['The spelling of a color.', 'Only a keyboard character.', 'The number of output wires.'], /based on TIME/i],
    ['What is ROM?', 'Read-only memory.', ['Random output multiplexer.', 'Rising-only memory.', 'Register overflow mode.'], /ROM: read.only memory/i],
    ['How many numbered states does the lecture’s traffic light use?', '6', ['3', '4', '12'], /numbers: 0-5/i],
  ],
};

export function buildTerminology(source: SourceDetail): PracticeQuestion[] {
  return (terms[source.id] ?? []).flatMap(([prompt, correct, distractors, pattern]) => {
    const q = question(source, 'Terminology', prompt, correct, distractors,
      correct, pattern, 'terminology');
    return q ? [q] : [];
  });
}
