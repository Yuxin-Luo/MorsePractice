export default {
  app: {
    title: 'Morse Code Practice',
    tagline: 'Decode morse · build muscle memory',
  },
  direction: {
    forward: 'See morse → type',
    listen: '👂 Hear morse → type',
  },
  mode: {
    letter: 'Letter / Digit',
    word: 'Word',
    sentence: 'Sentence',
  },
  prompt: {
    label: 'Type the text corresponding to this morse code:',
    target: 'Target: ',
    hint: '(hint — you can also click 🔊 to listen)',
    listenHint: '🔊 Press play, then type what you hear',
    showAnswer: 'Show answer',
    hideAnswer: 'Hide answer',
    toggleAnswerAria: 'Toggle answer visibility',
    maskItem: '? ? ?',
  },
  input: {
    placeholder: 'Type your answer...',
  },
  action: {
    play: 'Play',
    retry: 'Retry',
    next: 'Next',
    prev: 'Previous',
    reference: '📖 Morse chart',
  },
  feedback: {
    correct: '✅ Correct!',
    wrong: '❌ Wrong',
    partial: '⚠️ Partial',
    empty: '⚠️ Please type an answer first',
    expected: 'Expected: ',
    youTyped: 'You typed: ',
  },
  stats: {
    title: '📊 Cumulative stats',
    totalAttempts: 'Attempts',
    accuracy: 'Accuracy',
    uniqueChars: 'Chars seen',
    resetStats: 'Clear stats',
    resetStatsTitle: 'Clear cumulative stats (current practice unaffected)',
    confirmReset: 'Clear all cumulative stats? This cannot be undone.',
  },
  tips: {
    title: 'Shortcuts',
    play: 'Play morse',
    retry: 'Retry',
    next: 'Next',
    prev: 'Previous',
    submit: 'Submit',
    direction: 'Switch see/hear',
    reference: 'Open chart',
  },
  reference: {
    title: '📖 Morse code chart',
    hint: 'Click any character to hear it',
  },
  language: {
    switchTo: '中文',
  },
};
