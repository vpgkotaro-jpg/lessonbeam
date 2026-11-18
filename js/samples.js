/* Two built-in sample lessons, written for this project. */
window.LB_SAMPLES = [
  {
    v: 1, id: 'sample-internet', title: 'How the internet works',
    text: [
      'The internet is not one machine or one company. It is millions of computers and cables agreeing to follow the same rules so they can pass small pieces of information to each other.',
      'When you open a web page, your device does not receive the page in one piece. The page is cut into many small packets. Each packet carries a label saying where it came from, where it is going, and which piece of the page it is. Think of mailing a long letter as dozens of numbered postcards.',
      'Routers are the post offices. A router reads the destination on a packet and passes it to the next router that is closer. Packets for the same page may travel different routes and arrive out of order. Your device uses the numbers to put them back in the right order, and it asks for any postcard that went missing.',
      'Names like example.org are easier to remember than the numeric addresses computers use. A service called DNS works like a phone book: you give it a name and it answers with an address.',
      'The same idea is behind LessonBeam. Your lesson was cut into numbered pieces, each piece carries a checksum, and the receiving device only accepts the lesson after every piece has arrived and the whole thing matches. The difference is that here the pieces travel as light from one screen to one camera instead of through cables.'
    ].join('\n\n'),
    quiz: [
      { q: 'Why is a web page split into packets?', options: ['So small pieces can take different routes and be re-ordered and re-sent if lost', 'Because screens are too small for whole pages', 'To make the page load slower on purpose', 'So only one router is needed'], answer: 0 },
      { q: 'What does a router do?', options: ['Stores every web page', 'Reads a packet’s destination and passes it toward the next closer router', 'Translates languages', 'Creates passwords'], answer: 1 },
      { q: 'What is DNS most like?', options: ['A battery', 'A search engine', 'A phone book that turns a name into an address', 'A video player'], answer: 2 },
      { q: 'How does a receiver know a lesson arrived correctly in LessonBeam?', options: ['It trusts the first piece', 'It checks every piece and a hash of the whole lesson', 'It asks a server', 'It cannot know'], answer: 1 }
    ]
  },
  {
    v: 1, id: 'sample-fractions', title: 'Fractions basics',
    text: [
      'A fraction describes a part of a whole. Write it as two numbers with a line between them, like 3/4. The bottom number, the denominator, says how many equal parts the whole is cut into. The top number, the numerator, says how many of those parts we are talking about.',
      'Picture a flatbread cut into 4 equal slices. If you eat 1 slice, you ate 1/4 of the bread and 3/4 is left. The slices must be equal. Cutting one big piece and three tiny pieces does not make quarters.',
      'Equivalent fractions name the same amount. 1/2 is the same as 2/4 and 4/8: multiply the top and the bottom by the same number and the amount does not change. This is how you compare fractions. To see which is bigger, 2/3 or 3/5, rewrite them with the same denominator: 2/3 = 10/15 and 3/5 = 9/15, so 2/3 is bigger.',
      'To add fractions with the same denominator, add the numerators and keep the denominator: 2/7 + 3/7 = 5/7. If the denominators differ, first rewrite them so they match. For 1/2 + 1/4, change 1/2 to 2/4, then 2/4 + 1/4 = 3/4.',
      'Practice: split a sheet of paper into 8 equal parts by folding it three times. Shade 3 parts. What fraction is shaded? What fraction is not shaded?'
    ].join('\n\n'),
    quiz: [
      { q: 'In the fraction 3/4, what does the 4 tell you?', options: ['How many parts we have', 'How many equal parts the whole is cut into', 'The size of each person’s share', 'Nothing'], answer: 1 },
      { q: 'Which fraction is equal to 1/2?', options: ['2/3', '1/4', '4/8', '3/8'], answer: 2 },
      { q: 'What is 2/7 + 3/7?', options: ['5/14', '5/7', '6/7', '1/7'], answer: 1 },
      { q: 'Which is bigger, 2/3 or 3/5?', options: ['2/3', '3/5', 'They are equal', 'Cannot compare'], answer: 0 }
    ]
  }
];
