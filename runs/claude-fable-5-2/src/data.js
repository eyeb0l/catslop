// All the words and numbers: what can be brought home, what it is worth, what
// the Tall One says about it, and what the Cat-alogue sells.

/**
 * hint: shown in the journal before the first delivery.
 * said: what the Tall One says, first time and after.
 * note: the cat's own field note, shown in the journal once delivered.
 */
export const GIFTS = {
  butterfly: {
    name: 'Butterfly', value: 3,
    hint: 'Flutters over the meadow flowers by day. A little hop will do.',
    said: ['A butterfly. Slightly used. Thank you, I will… put it with the others.', 'Another butterfly. The windowsill is full.', 'Lovely. Very dead. Thank you.'],
    note: 'Flappy. Tastes of dust and victory.',
  },
  firefly: {
    name: 'Firefly', value: 3,
    hint: 'Small lights that drift about after dark.',
    said: ['It is still blinking. Why is it still blinking.', 'You have brought me a very small lamp.', 'Blink. Blink. Thank you. Blink.'],
    note: 'A star. I caught a star. Nobody else here is catching stars.',
  },
  moth: {
    name: 'Moth', value: 5,
    hint: 'Circles the lamps at night, well above cat height. Aim up.',
    said: ['You got this off the porch lamp. That lamp is two metres up. How.', 'Moth. Dusty. Fine.', 'Stop climbing my lamp.'],
    note: 'It worships the lamp. I worship nothing.',
  },
  frog: {
    name: 'Frog', value: 6,
    hint: 'Sits at the edge of the pond and leaves quickly.',
    said: ['It is alive. It is— no, it is leaving. It is in the kitchen now.', 'The frog again. We have met.', 'Ribbit to you too.'],
    note: 'Damp. Opinionated. Refuses to stay delivered.',
  },
  dragonfly: {
    name: 'Dragonfly', value: 8,
    hint: 'Darts over the pond in daylight. Pounce from the bank and accept getting wet.',
    said: ['How did you even. These do fifty kilometres an hour.', 'A dragonfly. You are showing off now.', 'Impressive. Horrible. Thank you.'],
    note: 'A stick that flies. I respect it. I caught it anyway.',
  },
  crab: {
    name: 'Crab', value: 8,
    hint: 'Walks sideways on the beaches. Do not approach from the front.',
    said: ['It pinched me. You brought me a thing that pinches.', 'Crab. I am wearing gloves this time.', 'Put it in the bucket. The BUCKET.'],
    note: 'Sideways. Armed. The Tall One sang its high song of thanks.',
  },
  mouse: {
    name: 'Mouse', value: 9,
    hint: 'Rustles in the tall golden grass, mostly from dusk. Sneak. Then do not sneak.',
    said: ['Oh! Oh no. Oh, you should not have. You REALLY should not have.', 'The doormat says NO MICE. You can read. I have seen you read.', 'Mouse. Yes. Good… cat.'],
    note: 'The classic. The Tall One climbed on a chair to see it better.',
  },
  goldfish: {
    name: 'Gerald', value: 10,
    hint: 'Something orange lives in the pond. It has a name.',
    said: ['That is GERALD. Put Gerald BACK.', 'How are there more Geralds.', 'Gerald. Again. He is getting used to it, which is worse.'],
    note: 'I entered the water ON PURPOSE. Let the record show it was on purpose.',
  },
  sparrow: {
    name: 'Sparrow', value: 12,
    hint: 'Pecks about on the ground by day and hears everything. Use the tall grass.',
    said: ['Absolutely not. No. Drop it. …It flew off. We will not speak of this.', 'It is fine. It is on the roof, being rude about you.', 'The birds have filed a complaint.'],
    note: 'It lives in the sky and I took it from the sky. Briefly.',
  },
  mackerel: {
    name: 'Mackerel', value: 18,
    hint: 'Silver things leap from the sea off the end of the dock.',
    said: ['This is an entire mackerel. This is dinner. Are you… providing for me?', 'Fish supper again. I am not complaining.', 'You are soaked and furious and holding a fish. Come here.'],
    note: 'The Tall One finally understands that it cannot hunt and I am keeping it alive.',
  },
  sock: {
    name: 'Sock', value: 5,
    hint: 'Hangs defenceless on the line beside the cottage.',
    said: ['That is my sock. That was on the line. That was CLEAN.', 'I only have odd ones left now.', 'Sock. Wonderful. My feet are cold.'],
    note: 'A cloth mouse with no bones. It did not even run.',
  },
  shell: {
    name: 'Seashell', value: 4,
    hint: 'Pale and curly, lying about on the sand.',
    said: ['Oh. That is actually quite nice. That is going on the windowsill.', 'Another shell. You have an eye for these.', 'Pretty. Sandy. Thank you.'],
    note: 'A rock the sea made by mistake. The Tall One kept it. Baffling.',
  },
  pinecone: {
    name: 'Pine Cone', value: 2,
    hint: 'Under the pines on the hill.',
    said: ['A pine cone. Right. Lovely. Thank you.', 'For the fire, I suppose.', 'Yes. That is a pine cone.'],
    note: 'Tree egg. Did not hatch.',
  },
  mushroom: {
    name: 'Mushroom', value: 7,
    hint: 'Red hat, white spots, deep in the woods.',
    said: ['Do NOT eat those. Did you eat one? Look at me. LOOK at me.', 'I am putting these very high up.', 'Still poisonous. Still no.'],
    note: 'I licked it and briefly saw the future. There were more mushrooms in it.',
  },
  reddot: {
    name: 'The Red Dot', value: 8,
    hint: 'Some nights it appears in the yard. It cannot be held. Try anyway.',
    said: ['(from the window) Ha! You actually got it. Three times! Here, you have earned these.', '(from the window) Never gets old.', '(from the window) Go on, again.'],
    note: 'It has no smell. It cannot be bitten. I have caught it and it is not in my mouth. Investigation ongoing.',
  },
};
export const GIFT_ORDER = ['butterfly', 'frog', 'sock', 'shell', 'pinecone', 'firefly', 'moth', 'mouse', 'crab', 'dragonfly', 'goldfish', 'sparrow', 'mushroom', 'mackerel', 'reddot'];
export const FIRST_TIME_BONUS = 3;

export const SHOP = [
  { id: 'backpack', kind: 'gear', name: 'Tiny Backpack', price: 30, blurb: 'Carry four gifts instead of one. Has a zip you cannot work.' },
  { id: 'softPaws', kind: 'gear', name: 'Soft Paws', price: 30, blurb: 'Prey hears you a third later. Felt, allegedly.' },
  { id: 'springy', kind: 'gear', name: 'Springy Legs', price: 40, blurb: 'Pounce a third further and higher.' },
  { id: 'nightEyes', kind: 'gear', name: 'Night Eyes', price: 25, blurb: 'Living things glint in the dark.' },
  { id: 'wings', kind: 'gear', name: 'Water Wings', price: 30, blurb: 'Swim twice as fast. Dignity not included.' },
  { id: 'zoomies', kind: 'gear', name: 'The Zoomies', price: 45, blurb: 'Hold Shift to go far too fast for no reason.' },
  { id: 'bell', kind: 'gear', name: 'Bell Collar', price: -40, blurb: 'Sponsored by the Sparrow Council, who will PAY you 40 treats to wear it. Everything hears you coming.' },
  { id: 'coat:tuxedo', kind: 'coat', name: 'Coat: Tuxedo', price: 20, blurb: 'Formal. For crimes.' },
  { id: 'coat:smoke', kind: 'coat', name: 'Coat: Smoke', price: 20, blurb: 'Grey tabby. Invisible on gravel.' },
  { id: 'coat:siam', kind: 'coat', name: 'Coat: Siam', price: 20, blurb: 'Cream with dipped ends. Blue eyes. Loud.' },
  { id: 'coat:calico', kind: 'coat', name: 'Coat: Calico', price: 20, blurb: 'Three colours, one cat, no plan.' },
  { id: 'coat:void', kind: 'coat', name: 'Coat: The Void', price: 25, blurb: 'A cat-shaped absence with eyes.' },
  { id: 'hat:party', kind: 'hat', name: 'Party Hat', price: 10, blurb: 'It is always somebody’s birthday.' },
  { id: 'hat:wizard', kind: 'hat', name: 'Wizard Hat', price: 20, blurb: 'Knows one spell. The spell is knocking things off tables.' },
  { id: 'hat:crown', kind: 'hat', name: 'Crown', price: 35, blurb: 'Merely confirms what was already true.' },
  { id: 'catslop', kind: 'goal', name: 'A tin of CATSLOP™', price: 150, blurb: 'Premium paté. “Now with 40% more slop.” The reason for all of this.' },
];

export const TIPS = [
  { id: 'move', text: '<b>W A S D</b> to walk · <b>mouse</b> to look around' },
  { id: 'jump', text: 'Tap <b>Space</b> to hop · hold <b>Space</b> to aim a pounce, release to leap' },
  { id: 'catch', text: 'Things can only be caught mid-pounce. Find something that moves.' },
  { id: 'carry', text: 'Excellent. Now carry it home to the <b>doormat</b>.' },
  { id: 'shop', text: 'You have treats. Read the <b>Cat-alogue</b> on the porch bench (<b>E</b>).' },
  { id: 'sneak', text: 'Some prey has ears. <b>C</b> to sneak · tall golden grass hides you completely' },
  { id: 'journal', text: '<b>J</b> opens your gift journal · <b>M</b> to meow · <b>Shift</b> to run' },
];
