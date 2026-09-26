// A fictional demo novel, "The Salt House", to show what the studio can do.
// It is deliberately unrelated to any real work in progress.
import type { Project } from '../types';
import {
  newBelief,
  newChapter,
  newCharacter,
  newClue,
  newEvent,
  newFact,
  newIdea,
  newNote,
  newPlace,
  newProject,
  newRelationship,
  newResearch,
  newScene,
  newSecret,
  emptyOutline,
} from './factory';

const CH1 = `The ferry was late, and nobody on it seemed surprised.

Nora stood at the rail with her bag between her feet and watched Carrick Bay come up out of the rain the way it always had, one piece at a time. The breakwater first. Then the cannery roofs, rust-streaked, and the white church the Catholics had sold to the Methodists and the Methodists had sold to a man from Portland who wanted to turn it into a restaurant and had given up. Then the hill, and at the top of it the Salt House, with every window lit.

Tess would never have lit every window. Tess counted the electric bill the way other people counted calories.

"You're the sister," said the man beside her. He had a Carrick Bay face, wind-reddened, the eyes gone small from squinting at weather. She didn't know him. That was the thing about leaving at sixteen. The town kept a picture of you, and you kept nothing of the town.

"Yes."

"Terrible thing." He waited. When she didn't give him anything, he nodded at the water as if it had said something he agreed with. "That breakwater. Every few years."

She could have told him that Tess had walked that breakwater since she was four years old. That she knew every loose block and every weed-slick stretch of it, and used to do it at night with her eyes shut to frighten their mother. She said, "Excuse me," and went inside to where the coffee machine was.

*

Her mother met her at the door, which meant she had been watching from the window.

Margaret Vale was sixty-seven and had been beautiful in the way that turns, with age, into a kind of severity. She wore a grey cardigan buttoned to the throat. Her hair was done. Of course her hair was done.

"You look tired," Margaret said.

"It was a long drive. And the ferry."

"The ferry's always late in November." Her mother stepped back to let her in, and for a moment neither of them knew what to do with their arms. Then Margaret took the bag from her, which settled it.

The hallway smelled of lemon polish and, under that, damp. The coats were on their hooks. Their father's oilskin had hung on the end hook for twenty-two years, stiff and yellow and absurd, a thing none of them would touch.

The hook was empty.

"The police have it," her mother said. "She was wearing it."

"Why would she wear Dad's coat?"

"I don't know, Nora. It was raining." Margaret carried the bag up the stairs. Halfway she stopped, without turning round. "I've made up your old room. I didn't know if you'd want Tess's. People sometimes do."

"No."

"No. I didn't think so."

*

The detective had been polite on the phone. Accidental drowning, he said. No sign of anything else. Some alcohol in her blood, not a great deal. The breakwater was notorious. He was very sorry.

Nora had spent eleven years reading insurance claims for a living. She knew what very sorry sounded like when it meant the file was closed.

She sat on her old bed, under the slope of ceiling where she used to bang her head, and read Tess's last message again, though she knew it the way you know a phone number from childhood.

Found something of Dad's. Call me when you can. Don't tell Mum.

9:14 p.m. And under it the missed call at 9:40, which Nora had watched ring out on her kitchen counter in Boston because she was tired, and it was Tess, and Tess always wanted something.

She hadn't told the detective about the message. She hadn't decided why.

*

At six her mother called up that there was soup. The kitchen was full of casseroles in foil, each with a name on masking tape. Pryce. Halloran. St. Brendan's. Someone had brought a whole ham.

"Owen came by," her mother said. "He sat with me yesterday. He's been very good."

"How is he?"

"Old." Margaret set a bowl down. "He asked after you. He's doing the reading tomorrow. I hope you don't mind. You weren't here to ask."

The soup was from a tin. Nora ate it anyway. Through the window the lighthouse on the point was dark, and then it wasn't: a small white light moving around the top of it. Not the beam. Someone walking up there with a lamp.

"Someone's in the lighthouse."

"That's the man doing it up. Crane." Her mother's spoon paused. "Tess liked him."

It was said lightly. It was not light.

"Liked him how?"

"I wouldn't know. She didn't tell me things." Margaret stood and took Nora's bowl, though it wasn't empty. "She told you things, I suppose."

Don't tell Mum.

"Not really," Nora said.

*

She couldn't sleep. At two she went down for water and stood in the dark hallway in her socks, looking at the row of coats. Tess's green parka hung in the middle, where it always had. Nora touched the sleeve. It smelled of her, of the cheap almond hand cream she'd used since high school, and Nora stood there for a while with her hand on it.

When she let go, something crackled in the pocket. A receipt, folded small. Carrick Bay Harbour Office. Berth 14, back fees, paid in cash. The third of November, 4:52 p.m.

Berth 14 had been their father's. It had been empty for twenty-two years.

Nora folded it the way Tess had, small and precise, and put it in her own pocket. Upstairs the house made its night noises, the pipes and the loose sash and the wind, and she lay listening to them as she had at sixteen, trying to tell which ones were only the house.
`;

const CH2 = `The church hall had been decorated for a harvest supper that was now postponed, so Tess's wake happened under paper leaves.

Nora stood by the urn and let people tell her things. That Tess had done the flowers for their daughter's wedding. That Tess had lent them the downstairs room when their pipes went. That Tess had been, and here they always stopped and looked up at the paper leaves, such a lovely girl, though Tess had been thirty-four and had once put a chair through the window of the Anchor.

Owen Pryce found her there. He had shrunk. That was her first thought, and she was ashamed of it. He had been the biggest man in her childhood, bigger than her father, a man who could lift her onto his shoulders with one arm. Now his suit hung off him and he held his tea in both hands to keep it level.

"Nora." He didn't hug her. He had never hugged anyone. He put a hand on her shoulder, briefly, the way he used to steady a boat against the dock. "You read well up there."

"You read better. I didn't know you knew Auden."

"I don't. Your mother picked it." He looked into his tea. "She'd have hated this. Tess."

"She'd have hated the leaves."

That got something like a smile. Then it went. "Did they give you back the watch?"

"What watch?"

"Your dad's. The Seiko. She had it on." He said it gently, as if she ought to have known, and Nora felt the old shame of being the one who left, the one who wasn't told things. "I gave it to him. The Christmas before the boat. She wore it every day after. Too big for her. She had an extra hole punched in the strap."

Nora hadn't known. She said so. Owen nodded, patted her shoulder again, and moved off toward her mother, who sat very straight on a folding chair by the stage with a line of people waiting to speak to her.

Across the room Julian Hart was drinking something that wasn't tea out of a paper cup. He had been engaged to Tess for most of a year, and then he hadn't been, and Tess had never said why. Only that it was done, really done, Nor, don't. In the voice that meant she'd cried about it already and wasn't going to again.

He saw Nora looking and came over, too quickly.

"I wasn't even here," he said. "That night. I want you to know that. I was on the nine o'clock. I was in Rockland by ten."

"Okay."

"People are saying things."

"I haven't heard anyone say anything, Julian."

"Well. They are." He drank. "Nine o'clock. Ask anyone."

At the back of the hall, near the door, a man in a dark coat stood by himself. He hadn't taken anything to eat. He wasn't looking at the room. He was looking at the photograph of Tess on the easel by the stage, the one from the summer fair where she was laughing at something outside the frame, and he looked at it for a long time. Then he put on his hat and went out.

Nora set down her cup.
`;

export function demoProject(): Project {
  const p = newProject('The Salt House');
  p.isDemo = true;
  p.author = 'Demo Author';
  p.status = 'Drafting';
  p.targetChapters = 28;
  p.targetWords = 85000;

  const nora = newCharacter('Nora Vale', {
    role: 'Protagonist',
    fields: {
      age: '38',
      occupation: 'Insurance claims investigator in Boston',
      appearance: 'Tall, bitten nails she hides in her sleeves, her father\'s heavy eyebrows.',
      personality: 'Watchful, dry, slow to trust, quick to judge. Uses competence as armour.',
      history: 'Left Carrick Bay at sixteen, a year after her father drowned. Has been home four times in twenty-two years.',
      publicPersona: 'The one who got out. Capable, a little cold.',
      privateSelf: 'Carries a quiet certainty that she abandoned her sister, twice.',
      goals: 'Find out what really happened to Tess the night she died.',
      desires: 'To be forgiven, though there is no one left to do it.',
      fears: 'That she is her mother. That the missed call mattered.',
      moralBoundaries: 'Won\'t lie to the police outright. (She will withhold.)',
      breakingPoint: 'Evidence that someone she loved let Tess die to protect themselves.',
      arc: 'From detached investigator of other people\'s lies to someone who has to face her family\'s, and her own.',
      secrets: 'Tess called her at 9:40 p.m. the night she died. Nora let it ring.',
      knows: 'Tess texted "Found something of Dad\'s. Call me when you can. Don\'t tell Mum." at 9:14 p.m.',
      believes: 'Tess did not slip.',
      doesNotKnow: 'That Owen was on her father\'s boat. That Elias saw Tess that night.',
      voice: 'Short sentences. Asks questions instead of answering them. Deflects feeling with procedure.',
      phrases: '"Okay." (meaning: I\'m not going to argue, and I don\'t believe you.)',
      neverSay: 'Anything sentimental out loud.',
      mannerisms: 'Folds paper small. Counts things when anxious.',
      romance: 'Elias Crane: slow, wary, complicated by what he isn\'t telling her.',
    },
  });
  const tess = newCharacter('Tess Vale', {
    role: 'The victim',
    fields: {
      age: '34 at death',
      occupation: 'Ran the Salt House guesthouse',
      personality: 'Warm, reckless, stubborn, funny. Stayed when Nora left and resented her for it, and loved her anyway.',
      history: 'Stayed in Carrick Bay after their father\'s death. Engaged to Julian Hart, broke it off in late summer.',
      secrets: 'Had found proof that their father did not go out alone the night he drowned.',
      mannerisms: 'Wore her father\'s watch with an extra hole punched in the strap.',
    },
  });
  const margaret = newCharacter('Margaret Vale', {
    role: 'Mother',
    fields: {
      age: '67',
      personality: 'Controlled, brittle, proud. Manages grief like housework.',
      publicPersona: 'The widow who held it together.',
      privateSelf: 'Has lived for twenty-two years with a suspicion she chose not to look at.',
      secrets: 'Had an affair with Owen Pryce in the year before Peter died.',
      lies: 'Says she doesn\'t know why Tess was wearing the oilskin.',
      believes: 'Wants to believe Tess slipped.',
      voice: 'Formal, complete sentences. Criticism delivered as concern.',
      mannerisms: 'Takes plates away before people have finished.',
    },
  });
  const elias = newCharacter('Elias Crane', {
    role: 'Love interest / suspect',
    fields: {
      age: '41',
      occupation: 'Restoring the lighthouse on the point',
      appearance: 'Burn scar across the back of his left hand. Dresses like he\'s about to go out in weather.',
      personality: 'Quiet, precise, kind in practical ways, bad at explaining himself.',
      history: 'Came to Carrick Bay two years ago after a divorce. Keeps to himself.',
      secrets: 'Found Peter Vale\'s logbook in the lighthouse storeroom and gave it to Tess at about 10 p.m. the night she died.',
      wantsOthersToBelieve: 'That he barely knew Tess.',
      voice: 'Says less than he means. Long pauses. Never fills a silence.',
      romance: 'Nora. Drawn to her because she\'s the only person in town who asks real questions.',
    },
  });
  const owen = newCharacter('Owen Pryce', {
    role: 'Harbourmaster, family friend',
    fields: {
      age: '64',
      occupation: 'Harbourmaster for thirty years',
      personality: 'Steady, avuncular, respected. Beneath it, a man who has managed one terrible lie for most of his life.',
      publicPersona: 'The man who held the Vale family together after Peter died.',
      privateSelf: 'Guilt he has turned into devotion, and devotion he has turned into control.',
      secrets: 'Was at the helm of the Margaret Rose, drunk, the night Peter Vale drowned. Killed Tess when she confronted him.',
      lies: 'Testified Peter went out alone. Says he hadn\'t seen Tess for a week before she died.',
      breakingPoint: 'Already crossed.',
      voice: 'Slow, nautical, gentle. Calls women "love". Never swears.',
      mannerisms: 'Steadies people with a hand on the shoulder, as if they were boats.',
    },
  });
  const julian = newCharacter('Julian Hart', {
    role: 'Ex-fiancé / suspect',
    fields: {
      age: '36',
      occupation: 'Runs his late father\'s boatyard, badly',
      personality: 'Charming, weak, defensive, self-pitying.',
      secrets: 'Owes money to men who run a card game in the back of Rennick\'s. Was there the night Tess died.',
      lies: 'Claims he took the nine o\'clock ferry to Rockland.',
      voice: 'Talks too much, repeats himself when lying.',
    },
  });
  p.characters = [nora, tess, margaret, elias, owen, julian];

  const ch1 = newChapter('The Salt House', { text: CH1, status: 'Revising', povCharacterId: nora.id });
  const ch2 = newChapter('The Wake', { text: CH2, status: 'Drafting', povCharacterId: nora.id });
  const ch3 = newChapter('Low Water', { status: 'Outlined', povCharacterId: nora.id });
  const ch4 = newChapter('The Lamp Room', { status: 'Outlined', povCharacterId: nora.id });
  const ch5 = newChapter('Berth Fourteen', { status: 'Idea' });
  ch1.summary =
    'Nora returns to Carrick Bay by ferry for Tess\'s funeral. Her mother Margaret is controlled and distant. Their father\'s oilskin is missing from its hook: Tess was wearing it when she drowned, which Margaret can\'t explain. The detective has ruled it an accident. Nora rereads Tess\'s last text ("Found something of Dad\'s… Don\'t tell Mum", 9:14 p.m.) and remembers ignoring her 9:40 call. Margaret mentions Owen has been kind, and that Tess "liked" Elias Crane, who is restoring the lighthouse. At 2 a.m. Nora finds a harbour office receipt in Tess\'s parka: back fees for Berth 14, their father\'s old berth, paid at 4:52 p.m. on the day she died.';
  ch1.summaryWordCount = 0;
  ch2.outline = {
    ...emptyOutline(),
    happens: 'Tess\'s wake in the church hall. Owen mentions Tess was wearing Peter\'s watch. Julian insists, unprompted, that he took the nine o\'clock ferry. A stranger (Elias) stares at Tess\'s photo and leaves; Nora follows him.',
    who: 'Nora, Owen, Margaret, Julian, Elias',
    wants: 'To get through it without breaking, and to watch everyone.',
    obstacle: 'Everyone performing grief; her mother\'s judgement.',
    learns: 'About the watch. That Julian is scared.',
    question: 'Why did Elias leave, and what does he know?',
    feel: 'Claustrophobic politeness with something wrong underneath.',
    unanswered: 'Whether Owen\'s detail about the watch matters (it does).',
  };
  ch3.outline = {
    ...emptyOutline(),
    happens: 'Nora checks the tide tables for the night of the 3rd and walks the breakwater at the time Tess supposedly fell. At that hour the water at its foot would have been mud. Elias finds her there.',
    who: 'Nora, Elias',
    wants: 'Proof that Tess didn\'t fall where they say she fell.',
    obstacle: 'Elias won\'t say why he was at the wake, or what he knew about Tess.',
    learns: 'The tide was out at 11 p.m. Elias admits he "saw Tess that week", not that night.',
    changes: 'Nora stops doubting herself. She now knows the official story is wrong.',
    question: 'If Tess didn\'t drown here, where did she die, and who moved her?',
    feel: 'Cold, exposed, a first electric wariness between Nora and Elias.',
    unanswered: 'Where Tess actually died.',
  };
  ch4.outline = { ...emptyOutline(), happens: 'Nora visits Elias at the lighthouse. She sees the storeroom where something was recently removed from a shelf.', learns: 'Elias is hiding something to do with her father.' };
  p.chapters = [ch1, ch2, ch3, ch4, ch5];
  p.currentChapterId = ch2.id;

  p.scenes = [
    newScene(ch1.id, { order: 1, title: 'The ferry', location: 'Carrick Bay ferry', time: 'Nov 9, late afternoon', povCharacterId: nora.id, characterIds: [nora.id], purpose: 'Arrival; establish Nora\'s distance from the town and her certainty Tess didn\'t fall.', revealed: 'Tess knew the breakwater perfectly.', endingBeat: 'She walks away from the stranger\'s sympathy.', status: 'Done' }),
    newScene(ch1.id, { order: 2, title: 'The oilskin', location: 'The Salt House', time: 'Nov 9, evening', povCharacterId: nora.id, characterIds: [nora.id, margaret.id], purpose: 'Mother and daughter; the missing oilskin.', conflict: 'Margaret deflects every question.', povWants: 'An explanation.', opposingWants: 'To not talk about it.', revealed: 'Tess was wearing Peter\'s oilskin.', concealed: 'Why (Margaret suspects).', clueIntroduced: 'The oilskin', relationshipChange: 'Nora notices Margaret\'s evasions.', status: 'Done' }),
    newScene(ch1.id, { order: 3, title: 'The receipt', location: 'The Salt House hallway', time: 'Nov 10, 2 a.m.', povCharacterId: nora.id, characterIds: [nora.id], purpose: 'First hard clue.', revealed: 'Tess was at the harbour office the afternoon she died.', clueIntroduced: 'Berth 14 receipt', emotionalChange: 'Grief → resolve.', endingBeat: 'Listening to the house, unsure which noises are only the house.', status: 'Revising' }),
    newScene(ch2.id, { order: 1, title: 'Paper leaves', location: 'St. Brendan\'s church hall', time: 'Nov 10, afternoon', povCharacterId: nora.id, characterIds: [nora.id, owen.id, julian.id, margaret.id, elias.id], purpose: 'Introduce suspects under social pressure.', conflict: 'Everyone performing; Julian over-explaining.', povWants: 'To watch.', revealed: 'Owen knows Tess wore the watch. Julian\'s ferry alibi.', concealed: 'Owen\'s guilt; Elias\'s connection.', clueIntroduced: 'The watch; Julian\'s alibi', endingBeat: 'Nora sets down her cup to follow Elias.', status: 'Drafting' }),
    newScene(ch3.id, { order: 1, title: 'The breakwater at eleven', location: 'The breakwater', time: 'Nov 11, 11 p.m.', povCharacterId: nora.id, characterIds: [nora.id, elias.id], purpose: 'Disprove the official story; first real Nora–Elias scene.', conflict: 'Nora wants answers; Elias won\'t give them.', povWants: 'Proof.', opposingWants: 'To protect himself, and to help her without admitting why.', revealed: 'The tide was out at 11 p.m.', concealed: 'That Elias saw Tess the night she died.', clueIntroduced: 'Tide times', relationshipChange: 'Wary attraction.', status: 'Outlined' }),
  ];

  p.relationships = [
    newRelationship(nora.id, elias.id, {
      kind: 'Strangers → wary allies → something more',
      description: 'He knew Tess. He knows something. He is the only person who treats Nora\'s questions as reasonable.',
      tension: 'He is hiding that he saw Tess the night she died.',
      isRomance: true,
      romance: { attraction: 4, trust: 2, vulnerability: 2, conflict: 5, dependence: 1, power: 6 },
      beats: [{ id: 'b1', chapterId: ch2.id, note: 'She notices him looking at Tess\'s photograph; follows him out.' }],
    }),
    newRelationship(nora.id, margaret.id, { kind: 'Mother and daughter', description: 'Twenty-two years of politeness over an unspoken wound.', tension: 'Each blames the other for leaving Tess alone.' }),
    newRelationship(margaret.id, owen.id, { kind: 'Old friends, former lovers', description: 'Publicly: he\'s the family\'s rock. Privately: an affair, ended when Peter died.', tension: 'She half-knows what he did.' }),
    newRelationship(tess.id, julian.id, { kind: 'Former fiancés', description: 'She ended it in late summer after finding out about his debts.' }),
    newRelationship(nora.id, owen.id, { kind: 'Surrogate uncle', description: 'He carried her on his shoulders as a child. She trusts him instinctively.', tension: 'Dramatic irony: the reader will learn to fear him before she does.' }),
  ];

  p.bible = {
    ...p.bible,
    genre: 'Dark Mystery / Psychological Thriller, with slow-burn romance',
    premise:
      'When her younger sister drowns off the breakwater of their Maine hometown, Nora Vale returns for the funeral and cannot accept that Tess, who knew that breakwater blindfolded, simply slipped. Her questions reopen the death of their father twenty-two years earlier, and lead to the man who has spent two decades holding her family together.',
    themes: 'Guilt and the stories families agree to tell. Kindness as a form of control. The sea as something that keeps things, and gives them back.',
    setting: 'Carrick Bay, a fictional island fishing town off the coast of Maine, in November. One ferry a day in winter. Everyone knows everyone\'s boat.',
    rules: 'Realistic. Small-town policing: one detective from the mainland, who has closed the case.',
    objects: 'Peter Vale\'s yellow oilskin. His Seiko watch. His logbook from the Margaret Rose.',
    majorReveals: 'Midpoint: Tess died on land, not in the water. Act 3: Owen was on the boat when Peter died, and killed Tess to keep it buried.',
    structure: 'Investigation structure with a slow-burn romance thread; roughly 28 chapters.',
    povPlan: 'Close third person, Nora only.',
    tense: 'Past tense',
  };
  p.tone = {
    darkness: 7,
    romance: 4,
    violence: 3,
    psychological: 8,
    complexity: 6,
    atmosphere: 8,
    explicitness: 2,
    pace: 4,
    description: 'Quiet dread rather than shocks. Disturbing but never gratuitous.',
    styleWords: 'claustrophobic small-town secrets, restrained, literary but accessible, slow burn',
    avoid: 'Lingering gore. Harm to animals. Explicit sex on the page.',
    influences:
      "Daphne du Maurier's Rebecca: the house and the past pressing on the present, a narrator who doubts herself. Agatha Christie: clues hidden in plain sight, a solution that's obvious afterwards. Ann Cleeves: a small place where everyone knows everyone, weather as mood. I love slow, quiet dread and dry humour.",
    styleProfile: '',
  };
  p.mystery = {
    centralQuestion: 'How did Tess Vale really die?',
    culprit: 'Owen Pryce',
    whatHappened:
      'Tess found proof (her father\'s logbook, via Elias) that Owen was at the helm of the Margaret Rose the night Peter drowned. She confronted Owen at the harbour boathouse around 11 p.m. on Nov 3. He struck her; she hit her head on the slipway and died. At high tide (about 2 a.m.) he put her body in the water at the breakwater.',
    whatAppears: 'Tess, a little drunk, walked the breakwater in a storm and slipped.',
    whatCharactersBelieve: 'Town and police: accident. Margaret: wants to believe accident. Nora: not an accident, but no idea why.',
    when: 'Night of Nov 3, about 11 p.m. Body placed in the water around 2 a.m. Nov 4.',
    motive: 'To bury the truth about Peter Vale\'s death, and his own life built on that lie.',
    competingMotives: 'Julian: debts and a broken engagement. Elias: the last person to see her; secretive. Margaret: letters she burned.',
    method: 'Blow to the head in the boathouse, body moved by dinghy to the breakwater at high tide.',
    opportunity: 'Owen has keys to everything on the harbour and knows the tides better than anyone.',
    evidence: 'The tide times. The watch, missing from the police property list but mentioned by Owen. Torn logbook.',
    coverUp: 'Timed the body to the tide; removed the logbook; kept the watch because it came off in the struggle.',
    whoIsLying: 'Owen (hadn\'t seen her in a week), Julian (the ferry), Elias (omits the logbook visit), Margaret (the oilskin, the letters).',
    whoIsManipulated: 'Margaret, by Owen, for twenty-two years.',
  };
  p.clues = [
    newClue({ title: 'Last text message', description: '"Found something of Dad\'s. Call me when you can. Don\'t tell Mum." 9:14 p.m. Nov 3.', kind: 'genuine', pointsTo: 'The past: Peter\'s death', significance: 'Tess had discovered something about their father.', whoKnowsIds: [nora.id], appearsChapterId: ch1.id }),
    newClue({ title: 'Berth 14 receipt', description: 'Harbour office receipt in Tess\'s parka: back fees on their father\'s old berth, 4:52 p.m. Nov 3.', kind: 'genuine', pointsTo: 'Owen (he said he hadn\'t seen her in a week)', significance: 'Tess visited Owen\'s office the day she died, as a pretext to see his reaction.', whoKnowsIds: [nora.id], appearsChapterId: ch1.id }),
    newClue({ title: 'The watch', description: 'Owen knows Tess was wearing Peter\'s Seiko. The police property list doesn\'t include a watch.', kind: 'genuine', pointsTo: 'Owen', significance: 'He could only know if he saw her that night.', whoKnowsIds: [nora.id, owen.id], appearsChapterId: ch2.id, resolvedChapterId: '' }),
    newClue({ title: 'Tide times', description: 'At 11 p.m. on Nov 3 the tide was out. The foot of the breakwater was mud. High water was around 2 a.m.', kind: 'genuine', pointsTo: 'Someone who knows the tides; the body was moved', whoKnowsIds: [nora.id], appearsChapterId: ch3.id }),
    newClue({ title: 'Elias\'s van outside the Salt House', description: 'A neighbour saw Elias\'s van outside the Salt House around 10 p.m. on Nov 3.', kind: 'misleading', pointsTo: 'Elias', trueExplanation: 'He was delivering the logbook. He left at 10:20.', whoKnowsIds: [], appearsChapterId: ch4.id }),
    newClue({ title: 'Julian\'s ferry alibi', description: 'Julian insists he was on the nine o\'clock ferry. The ferry log shows he didn\'t board.', kind: 'red-herring', pointsTo: 'Julian', trueExplanation: 'He was at an illegal card game in the back of Rennick\'s all night, losing money he doesn\'t have.', whoKnowsIds: [julian.id], appearsChapterId: ch2.id }),
    newClue({ title: 'Ashes in the stove', description: 'The morning after Nora arrives, the kitchen stove holds the ash of burned letters. A scrap of blue airmail paper survives.', kind: 'red-herring', pointsTo: 'Margaret', trueExplanation: 'Owen\'s love letters from the affair, burned out of shame.', whoKnowsIds: [margaret.id], appearsChapterId: '' }),
  ];
  p.secrets = [
    newSecret({ title: 'Owen was on the boat', description: 'Owen was at the helm, drunk, when the Margaret Rose went down. He swam; Peter didn\'t. He testified Peter went out alone.', holderIds: [owen.id], hiddenFromIds: [nora.id, margaret.id], hiddenFromReader: true, ifRevealed: 'Reveals the killer and the motive. Ends the central question.' }),
    newSecret({ title: 'The affair', description: 'Margaret and Owen had an affair in the year before Peter died.', holderIds: [margaret.id, owen.id], hiddenFromIds: [nora.id], hiddenFromReader: true, ifRevealed: 'Makes Margaret look complicit; shifts suspicion onto her.' }),
    newSecret({ title: 'The logbook', description: 'Elias found Peter\'s logbook in the lighthouse storeroom and gave it to Tess at 10 p.m. on Nov 3.', holderIds: [elias.id], hiddenFromIds: [nora.id], hiddenFromReader: true, revealChapterId: '', ifRevealed: 'Elias becomes the last known person to see Tess alive.' }),
    newSecret({ title: 'The missed call', description: 'Nora ignored Tess\'s 9:40 p.m. call.', holderIds: [nora.id], hiddenFromIds: [margaret.id], hiddenFromReader: false, revealChapterId: ch1.id }),
  ];
  p.beliefs = [
    newBelief(nora.id, { belief: 'Tess didn\'t slip.', truth: 'true', sinceChapterId: ch1.id }),
    newBelief(margaret.id, { belief: 'Tess was drunk and slipped.', truth: 'false' }),
    newBelief(owen.id, { belief: 'No one else knows what was in the logbook.', truth: 'false' }),
    newBelief(nora.id, { belief: 'Owen is the one person in Carrick Bay she can trust.', truth: 'false', sinceChapterId: ch2.id }),
  ];
  p.facts = [
    newFact('Tess died on land, in the harbour boathouse, not in the water.', { readerLearnsChapterId: '' }),
    newFact('Tess was wearing her father\'s oilskin when her body was found.', { readerLearnsChapterId: ch1.id }),
    newFact('Owen gave Peter the Seiko watch the Christmas before he died.', { readerLearnsChapterId: ch2.id }),
  ];
  p.timeline = [
    newEvent({ title: 'The Margaret Rose goes down', dateKind: 'approx', approxLabel: 'October, 22 years ago', order: 1, location: 'Off Carrick Point', characterIds: [owen.id], onPage: false, description: 'Peter Vale drowns. Owen was aboard (secret).' }),
    newEvent({ title: 'Owen testifies Peter went out alone', dateKind: 'approx', approxLabel: '22 years ago', order: 2, characterIds: [owen.id], onPage: false }),
    newEvent({ title: 'Elias arrives in Carrick Bay', dateKind: 'approx', approxLabel: 'Two years ago', order: 3, characterIds: [elias.id], onPage: false }),
    newEvent({ title: 'Tess ends her engagement to Julian', dateKind: 'approx', approxLabel: 'Late summer', order: 4, characterIds: [tess.id, julian.id], onPage: false }),
    newEvent({ title: 'Elias finds the logbook', dateKind: 'exact', date: '2025-11-02', order: 5, location: 'Lighthouse storeroom', characterIds: [elias.id], onPage: false }),
    newEvent({ title: 'Tess pays Berth 14 fees at harbour office', dateKind: 'exact', date: '2025-11-03', time: '16:52', order: 6, location: 'Harbour office', characterIds: [tess.id, owen.id], onPage: false }),
    newEvent({ title: 'Julian at card game (claims ferry)', dateKind: 'exact', date: '2025-11-03', time: '21:00', order: 7, location: 'Rennick\'s back room', characterIds: [julian.id], onPage: false }),
    newEvent({ title: 'Tess texts Nora', dateKind: 'exact', date: '2025-11-03', time: '21:14', order: 8, location: 'The Salt House', characterIds: [tess.id], onPage: false }),
    newEvent({ title: 'Elias brings the logbook to Tess', dateKind: 'exact', date: '2025-11-03', time: '22:00', order: 9, location: 'The Salt House', characterIds: [elias.id, tess.id], onPage: false }),
    newEvent({ title: 'Tess confronts Owen; she dies', dateKind: 'exact', date: '2025-11-03', time: '23:00', order: 10, location: 'Harbour boathouse', characterIds: [tess.id, owen.id], onPage: false }),
    newEvent({ title: 'Body placed in the water at high tide', dateKind: 'exact', date: '2025-11-04', time: '02:00', order: 11, location: 'The breakwater', characterIds: [owen.id], onPage: false }),
    newEvent({ title: 'Nora arrives by ferry', dateKind: 'exact', date: '2025-11-09', time: '16:30', order: 12, location: 'Carrick Bay', characterIds: [nora.id], chapterId: ch1.id }),
    newEvent({ title: 'The wake', dateKind: 'exact', date: '2025-11-10', time: '14:00', order: 13, location: 'St. Brendan\'s church hall', characterIds: [nora.id, owen.id, julian.id, margaret.id, elias.id], chapterId: ch2.id }),
  ];
  p.places = [
    newPlace({ name: 'The Salt House', description: 'The Vale family home and guesthouse at the top of the hill. Six guest rooms, all empty in November.', details: 'Lemon polish over damp. A loose sash on the landing. Coat hooks in the hall, the end one empty.', significance: 'Where the family keeps its silences.' }),
    newPlace({ name: 'The breakwater', description: 'Granite blocks running 400 yards out from the harbour mouth.', details: 'Weed-slick on the seaward side. At low tide, mud and rope and a rusted shopping trolley at its foot.', significance: 'Where Tess was "found".' }),
    newPlace({ name: 'The lighthouse', description: 'Decommissioned light on Carrick Point, being restored by Elias Crane.', details: 'Paint scraped back to 1911 lettering. A storeroom of damp boxes from the old keepers.' }),
    newPlace({ name: 'Harbour office and boathouse', description: 'Owen\'s domain for thirty years.', details: 'Tide tables pinned by the door. A concrete slipway inside the boathouse.' }),
  ];
  p.ideas = [
    newIdea('Tess did not slip. She was dead before she went into the water.', { status: 'canon', category: 'mystery' }),
    newIdea('Margaret has always half-known what happened to Peter.', { status: 'possibility', category: 'character', linkId: margaret.id }),
    newIdea('Elias is Peter Vale\'s son from an old affair.', { status: 'possibility', category: 'twist', detail: 'Would explain why he came to Carrick Bay. Risk: melodrama, and it competes with the main reveal.' }),
    newIdea('Tess faked her own death.', { status: 'discarded', category: 'twist', detail: 'Undercuts the grief at the heart of the book.' }),
    newIdea('Nora finds the half-burned logbook in the harbour office stove in Act 3.', { status: 'possibility', category: 'plot' }),
  ];
  p.research = [
    newResearch({ title: 'Tide times on the Maine coast', category: 'Geography', content: 'Semi-diurnal tides: two highs and two lows a day, roughly 6 hours 12 minutes apart. The tidal range can be 9 to 12 feet or more, so a breakwater foot can be dry at low water.', url: 'https://tidesandcurrents.noaa.gov/', factStatus: 'known' }),
    newResearch({ title: 'Drowning vs. death before immersion', category: 'Forensics', content: 'Can a medical examiner tell if someone was dead before entering the water? Signs such as froth in the airways and water in the lungs/stomach are suggestive but not conclusive, and diatoms are debated. VERIFY with a forensic source or expert.', factStatus: 'needed' }),
    newResearch({ title: 'Carrick Bay ferry schedule', category: 'Setting', content: 'One ferry a day in winter, departing 9 p.m. for Rockland. (Invented for the novel.)', factStatus: 'fictional' }),
  ];
  p.notes = [newNote({ title: 'Why Owen keeps the watch', body: 'Maybe he can\'t throw it away because he gave it to Peter. Guilt as hoarding. The watch could be found in his desk, still set to the right time.' })];
  p.ending = {
    ...p.ending,
    resolution: 'Nora proves Owen killed Tess. Undecided: confession, arrest, or the sea.',
    characterArcs: 'Nora stops investigating other people\'s lies and tells her mother about the missed call.',
    romance: 'Open, hopeful, unresolved. Elias stays in Carrick Bay; Nora hasn\'t decided.',
    finalImage: 'The oilskin back on its hook.',
  };
  return p;
}
