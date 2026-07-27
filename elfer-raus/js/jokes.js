/* ============================================================
   jokes.js — certified Grade-A dad humor.
   Warning: side effects include groaning and eye-rolling.
   ============================================================ */

const JOKES = {
  // Rotating ticker jokes — shown on a timer during the game.
  ticker: [
    "Why did the 11 go first? It just couldn't wait to be odd.",
    "I used to hate card games. Then they grew on me. Now I'm dealing with it.",
    "What do you call a card that tells jokes? A wise-cracker.",
    "I'm reading a book about anti-gravity. It's impossible to put down — unlike your cards.",
    "Why don't cards ever get lost? They always follow suit.",
    "My wife said I should stop making card puns. I said, 'No deal.'",
    "What's a card's favorite dance move? The shuffle.",
    "I told my kids the Wi-Fi password is the red 11. They still can't connect.",
    "Why was 6 afraid of 7? Wrong game, but seven ate nine anyway.",
    "This game is like my lawn. I keep telling everyone to get the elfer raus.",
    "I would tell you a joke about the draw pile, but you'd just take it the wrong way.",
    "Why did the card go to school? To become a little number one-derful.",
    "What did the 10 say to the 11? 'You're one up on me.'",
    "I named my dog 'Twenty'. When he runs off, the row is finally complete.",
    "Cards are like dad jokes — timing is everything, and someone always groans.",
    "What did the blue card say to the red card? 'You look flushed.'",
    "Why don't we play hide and seek with the 11s? Good players always find them out.",
    "My doctor said I need to shuffle more. So I bought another deck.",
    "What's the loudest number in the deck? The ele-VEN.",
    "I only know 25 letters of the alphabet. I don't know why. Oh wait — Y.",
    "Never play cards in the jungle. Too many cheetahs.",
    "Why did the deck apologize? It had a lot of bad deals.",
    "What do you call two 11s in a row? A par-elfer-lel.",
    "I asked the deck for a hint. It said 'that's not in the cards.'",
    "I'm on a seafood diet. I see cards, and I play them.",
  ],

  // Shown as a toast when somebody has to draw cards.
  draw: [
    '"Hi Drawing Three, I\'m Dad." 👋',
    'Three more cards? That pile really grew on you.',
    'Drawing again? You must really love collecting.',
    "Don't worry — the best things in life come in threes.",
    'That draw pile called. It misses you already.',
    'More cards, more... character building.',
  ],

  // Occasionally shown when someone plays a nice card.
  play: [
    'Smooth. Like butter on a bald monkey.',
    'That card fit like dad jeans. Perfectly.',
    'Nailed it! And I know nails — I own a hammer.',
    "Now that's what I call a card-io workout.",
    'Textbook move. From a very silly textbook.',
  ],

  // Shown when someone opens a row with an 11.
  eleven: [
    'ELFER RAUS! 🎉 The 11 has left the building!',
    'An 11 appears! Somewhere, a dad nods approvingly.',
    'Row opened! This party is officially two digits.',
    'Eleven out! Just like my back — it also went out.',
  ],

  // Game-over zingers.
  win: [
    'Winner winner, schnitzel dinner! 🏆',
    'And the crowd goes mild! 🎉',
    "That was a-maize-ing. I'm corn-gratulating you.",
    'Some played cards. You played CHESS. (With cards.)',
    'Victory! Time to retire undefeated.',
  ],

  // When someone joins the lobby.
  join: [
    'has entered the chat. Hide your snacks.',
    'has joined. The plot thickens.',
    'is here! Quick, look competitive.',
    'has pulled up a chair. It squeaked.',
    'joined the table. No refunds.',
  ],
};

function randomJoke(category) {
  const list = JOKES[category] || JOKES.ticker;
  return list[Math.floor(Math.random() * list.length)];
}
