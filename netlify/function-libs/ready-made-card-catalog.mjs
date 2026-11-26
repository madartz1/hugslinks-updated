import { cards as birthdayCards } from "../../app/birthday-hugs-cards.mjs";

const birthday = { id: "birthday", title: "Birthday Hugs", cards: birthdayCards.map((card, index) => {
  const cover = "/assets/birthday-hugs/card-" + String(index + 1).padStart(2, "0") + ".webp";
  return { ...card, cover, inside: cover, titleOnCover: true };
}) };

export const collections = [birthday, ...[
  {
    "id": "gen-z-holiday-hugs",
    "title": "Gen Z Holiday Hugs",
    "cards": [
      {
        "title": "Bookie, You’re My Favorite",
        "wish": "Even when our plans turn into pajamas and a plate of leftovers, you’re still my favorite part.",
        "greeting": "Saving you a seat, a snack, and the biggest hug.",
        "cover": "/assets/gen-z-holiday-hugs/card-01.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-01.webp"
      },
      {
        "title": "It’s Giving Holiday Love",
        "wish": "The lights are cute, but the best part was laughing with you until the cocoa went cold.",
        "greeting": "Let’s make time for more of that.",
        "cover": "/assets/gen-z-holiday-hugs/card-02.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-02.webp"
      },
      {
        "title": "No Cap, You’re the Gift",
        "wish": "The thing I’m most grateful for this season doesn’t come with a tracking number.",
        "greeting": "Thanks for showing up for me. Sending that love right back.",
        "cover": "/assets/gen-z-holiday-hugs/card-03.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-03.webp"
      },
      {
        "title": "You Ate This Year, Bestie",
        "wish": "You handled a lot this year, including things nobody clapped for. I saw you.",
        "greeting": "I’m proud of you, bestie. Let’s celebrate in a way that feels good to you.",
        "cover": "/assets/gen-z-holiday-hugs/card-04.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-04.webp"
      },
      {
        "title": "Big Hugs, Little Legend",
        "wish": "You made more memories than you know just by being your funny, curious self.",
        "greeting": "Keep being you. I’m cheering for you and saving you a big hug.",
        "cover": "/assets/gen-z-holiday-hugs/card-05.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-05.webp"
      },
      {
        "title": "Sending You Big Holiday Hugs",
        "wish": "I wish I could hand you a warm mug and pull up a chair beside you today.",
        "greeting": "I’m thinking of you from here. Want to catch up when you have a minute?",
        "cover": "/assets/gen-z-holiday-hugs/card-06.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-06.webp"
      },
      {
        "title": "Everyone Needs a Hug",
        "wish": "Wherever this season finds you, I hope there’s a moment when you feel safe, cared for, and at ease.",
        "greeting": "Here’s a hug from me. I’d love to hear how you’re doing whenever you feel like talking.",
        "cover": "/assets/gen-z-holiday-hugs/card-07.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-07.webp"
      },
      {
        "title": "Love Is the Assignment",
        "wish": "Today I’m thinking about the little ways we show love, like saving someone a plate or calling when we said we would.",
        "greeting": "I’ve got a little time this week. Want to spend some of it together?",
        "cover": "/assets/gen-z-holiday-hugs/card-08.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-08.webp"
      },
      {
        "title": "Protect Our Planet",
        "wish": "I want our kids to have shady trees, clean water, and places they can play outside.",
        "greeting": "Want to join me for a neighborhood cleanup sometime? I’ll bring the gloves.",
        "cover": "/assets/gen-z-holiday-hugs/card-09.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-09.webp"
      },
      {
        "title": "Working Hard and Barely Surviving",
        "wish": "It’s exhausting to work so hard and still have to choose which bill can wait. I see how much you’re carrying.",
        "greeting": "I can bring dinner this week or sit with you while you make calls. Would either help?",
        "cover": "/assets/gen-z-holiday-hugs/card-10.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-10.webp"
      },
      {
        "title": "Children Deserve Childhoods",
        "wish": "Kids deserve safe places to play, enough to eat, and grown-ups who listen when something hurts.",
        "greeting": "I’m thinking of the little ones today and the people who help them feel safe.",
        "cover": "/assets/gen-z-holiday-hugs/card-11.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-11.webp"
      },
      {
        "title": "Less Ego. More Empathy.",
        "wish": "I’ve caught myself planning my reply while you were still talking. I want to do a better job hearing you.",
        "greeting": "If there’s something you still want to say, I’ll make time to listen.",
        "cover": "/assets/gen-z-holiday-hugs/card-12.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-12.webp"
      },
      {
        "title": "Healing Takes Time",
        "wish": "Some days the smallest thing takes all the energy you have. I’m thinking of you on those days, too.",
        "greeting": "Want a check-in this week? I can text first and follow your lead.",
        "cover": "/assets/gen-z-holiday-hugs/card-13.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-13.webp"
      },
      {
        "title": "Kindness Is a Flex",
        "wish": "You made time for me on a day when I was having a hard time asking for help. I still remember.",
        "greeting": "I hope someone makes today a little easier for you. It can be me.",
        "cover": "/assets/gen-z-holiday-hugs/card-14.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-14.webp"
      },
      {
        "title": "Protect Your Peace",
        "wish": "If the group chat gets loud and you need to mute it, I understand.",
        "greeting": "I’ll be around for a quiet walk or a call whenever you feel up to it.",
        "cover": "/assets/gen-z-holiday-hugs/card-15.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-15.webp"
      },
      {
        "title": "A Safe Home for Everyone",
        "wish": "Everybody deserves a door they can close and a place where they can sleep without worrying.",
        "greeting": "I’m thinking of you. If there’s a practical way I can help this week, I’m here to listen.",
        "cover": "/assets/gen-z-holiday-hugs/card-16.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-16.webp"
      },
      {
        "title": "You Deserve Rest",
        "wish": "I hope you get an afternoon with warm socks, a quiet phone, and absolutely nowhere you have to be.",
        "greeting": "Take it easy if you can. I’ll check in another day.",
        "cover": "/assets/gen-z-holiday-hugs/card-17.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-17.webp"
      },
      {
        "title": "No One Should Go Hungry",
        "wish": "A warm meal can make a hard day easier. Sharing one can make it feel a little less lonely.",
        "greeting": "I’d love to share a meal with you. Let’s find a time that works.",
        "cover": "/assets/gen-z-holiday-hugs/card-18.webp",
        "inside": "/assets/gen-z-holiday-hugs/card-18.webp"
      }
    ]
  },
  {
    "id": "christmas",
    "title": "Christmas HUGs",
    "cards": [
      {
        "title": "Deck the Halls. Not Your Relatives.",
        "group": "Humor",
        "greeting": "Less drama, more love. Merry Christmas!",
        "wish": "Here’s to laughter, good food, and room for love.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-01.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-01.webp"
      },
      {
        "title": "A Peaceful Christmas",
        "group": "Peace",
        "greeting": "Wishing you a peaceful Christmas.",
        "wish": "May you find quiet moments to breathe and feel cared for.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-02.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-02.webp"
      },
      {
        "title": "Generosity, Gratitude, and Good Company",
        "group": "Gratitude",
        "greeting": "Thank you for the kindness you share.",
        "wish": "May we share what we have and make room for one more at the table.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-03.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-03.webp"
      },
      {
        "title": "Faith, Hope & Blessings",
        "group": "Faith",
        "greeting": "May faith and hope carry you through the season.",
        "wish": "Wishing you peace, renewed hope, and Christmas blessings.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-04.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-04.webp"
      },
      {
        "title": "The Greatest Gifts",
        "group": "Love",
        "greeting": "The love we give each other is the greatest gift.",
        "wish": "May the people who show up for you bring warmth to your Christmas.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-05.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-05.webp"
      },
      {
        "title": "Christmas Filled With Love and Kindness",
        "group": "Love",
        "greeting": "May your Christmas be filled with love and kindness.",
        "wish": "I hope you give and receive kindness in the little moments this season.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-06.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-06.webp"
      },
      {
        "title": "Crazy Family. Beautiful Christmas.",
        "group": "Humor",
        "greeting": "Wishing you laughter and love.",
        "wish": "Here’s to making room for each other and laughing a little along the way.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-07.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-07.webp"
      },
      {
        "title": "Missing You Beneath the Christmas Lights.",
        "group": "Remembrance",
        "greeting": "Holding you close in my thoughts.",
        "wish": "The lights bring back memories of you. I’m carrying those memories with me this Christmas.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-08.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-08.webp"
      },
      {
        "title": "May Christmas Bring Your Heart Healing.",
        "group": "Healing",
        "greeting": "Wishing you comfort and healing.",
        "wish": "Take this season at your own pace. I hope a quiet moment brings you some comfort.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-09.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-09.webp"
      },
      {
        "title": "It’s Okay Not to Be Merry Every Moment.",
        "group": "Healing",
        "greeting": "Be gentle with yourself this Christmas.",
        "wish": "However today feels, you have room to feel it. I’m thinking of you.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-10.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-10.webp"
      },
      {
        "title": "Look How Far You’ve Come.",
        "group": "Hope",
        "greeting": "I’m celebrating how far you’ve come.",
        "wish": "Every small step counts. I hope you get a moment to see what you’ve made it through.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-11.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-11.webp"
      },
      {
        "title": "Different Branches. One Christmas Tree.",
        "group": "Family",
        "greeting": "There is room for all of us.",
        "wish": "May the traditions we make together leave room for every branch of the family.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-12.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-12.webp"
      },
      {
        "title": "The Gift of Family",
        "group": "Family",
        "greeting": "Being together is a gift I’ll always treasure.",
        "wish": "Whether we gather in one room or across the miles, I’m grateful for our family.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-13.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-13.webp"
      },
      {
        "title": "The True Gift of Christmas",
        "group": "Faith",
        "greeting": "May the peace of Christ fill your heart and home.",
        "wish": "Wishing you the hope, joy, and love of the Christmas story.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-14.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-14.webp"
      },
      {
        "title": "Wishing You Peace, Healing & Light",
        "group": "Healing",
        "greeting": "May peace and gentle light find you this Christmas.",
        "wish": "I’m wishing you time to rest and someone to lean on when you need it.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-15.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-15.webp"
      },
      {
        "title": "Family Is Where Love Lives.",
        "group": "Family",
        "greeting": "Thank you for making room for me.",
        "wish": "Family is also the people who show up. I’m grateful you’re one of mine.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-16.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-16.webp"
      },
      {
        "title": "Merry Christmas!",
        "group": "Joy",
        "greeting": "Wishing you a warm and beautiful Christmas.",
        "wish": "May family, friends, and the people you love bring happiness to your day.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-17.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-17.webp"
      },
      {
        "title": "Create Your Own Christmas HUG.",
        "group": "Personalize",
        "greeting": "",
        "wish": "May the care you put into this HUG make someone’s Christmas a little brighter.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-18.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/christmas-2026/inside-18.webp"
      }
    ]
  },
  {
    "id": "thanksgiving",
    "title": "Thanksgiving HUGs",
    "cards": [
      {
        "title": "Pass the Pie. Keep the Drama.",
        "group": "Funny & Thankful",
        "greeting": "Wishing you delicious food, peaceful company, and absolutely no unnecessary arguments.",
        "wish": "Save me a slice and a seat far away from the group debate.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-01.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-01.webp"
      },
      {
        "title": "Gratitude & Good Vibes",
        "group": "Funny & Thankful",
        "greeting": "Here's to the little things that made this year brighter. Happy Thanksgiving!",
        "wish": "Here’s to good food, good company, and the small joys we almost missed.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-02.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-02.webp"
      },
      {
        "title": "Leftovers Inspector",
        "group": "Funny & Thankful",
        "greeting": "Officially approving another helping of joy, laughter, and pie.",
        "wish": "The pie has been inspected. A second slice is officially cleared.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-03.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-03.webp"
      },
      {
        "title": "Thankful for My People",
        "group": "Family & Connection",
        "greeting": "Thank you for being one of the people who make life feel like home.",
        "wish": "Of all the good things I can count this year, I’m especially glad I can count you.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-04.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-04.webp"
      },
      {
        "title": "A Chance to Reconnect",
        "group": "Family & Connection",
        "greeting": "If the time feels right for both of us, I hope we can begin with kindness and listening.",
        "wish": "Some doors can open an inch at a time. We can start wherever feels right.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-05.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-05.webp"
      },
      {
        "title": "Complicated Families. Still Thankful.",
        "group": "Family & Connection",
        "greeting": "Whatever our family story looks like, I wish you a peaceful holiday.",
        "wish": "Every family has a few stories that take longer to tell. There’s room for ours.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-06.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-06.webp"
      },
      {
        "title": "Blended Families Bring Extra Love",
        "group": "Family & Connection",
        "greeting": "Different histories, new traditions, and room for everyone to belong.",
        "wish": "Here’s to the new traditions we’re making and all the people who make them ours.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-07.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-07.webp"
      },
      {
        "title": "Chosen Family Is Family, Too",
        "group": "Family & Connection",
        "greeting": "Family is also the people who show up, listen, and make space for us.",
        "wish": "I’m grateful for the people who pulled up a chair and made room for me.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-08.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-08.webp"
      },
      {
        "title": "Different Places, Still Connected",
        "group": "Family & Connection",
        "greeting": "Sending warmth from where I am to wherever you are. No pressure to reply.",
        "wish": "Different zip codes, same warm thought. You’re with me in spirit today.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-09.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-09.webp"
      },
      {
        "title": "Peace Is Worth Celebrating",
        "group": "Peace & Boundaries",
        "greeting": "May you enjoy a holiday that honors your needs and your peace.",
        "wish": "A quiet holiday can be a beautiful one. I hope yours has room to breathe.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-10.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-10.webp"
      },
      {
        "title": "Healthy Boundaries Are a Gift",
        "group": "Peace & Boundaries",
        "greeting": "You can be grateful and still choose what feels healthy for you.",
        "wish": "Wishing you the comfort of a kind yes and the freedom of a clear no.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-11.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-11.webp"
      },
      {
        "title": "Low Contact. Still Thankful for Peace.",
        "group": "Peace & Boundaries",
        "greeting": "No expectations, just a sincere wish for a peaceful season.",
        "wish": "I hope the season brings you some ease, wherever you’re spending it.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-12.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-12.webp"
      },
      {
        "title": "Missing Loved Ones",
        "group": "Healing & Mental Wellness",
        "greeting": "Holding space for the love and memories that remain with us.",
        "wish": "The people we miss are still part of the stories we tell and the traditions we keep.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-13.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-13.webp"
      },
      {
        "title": "Anxious Hearts Are Welcome, Too",
        "group": "Healing & Mental Wellness",
        "greeting": "You don't have to feel festive every minute. Be gentle with yourself.",
        "wish": "Whether you stay for the whole meal, step outside, or spend the day quietly, you belong.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-14.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-14.webp"
      },
      {
        "title": "Healing & Forgiveness",
        "group": "Healing & Mental Wellness",
        "greeting": "Healing can take time, and forgiveness is always your choice. Wishing you peace.",
        "wish": "May you find a little more ease today, at your own pace.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-15.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-15.webp"
      },
      {
        "title": "Support & Understanding Go a Long Way",
        "group": "Healing & Mental Wellness",
        "greeting": "Thank you for listening, caring, and being there in the ways that matter.",
        "wish": "Being understood can make a hard day feel lighter. Thank you for giving me that.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-16.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-16.webp"
      },
      {
        "title": "Thankful for Growth",
        "group": "New Beginnings & Gratitude",
        "greeting": "Here's to all the ways you've grown, even when the road was difficult.",
        "wish": "Some of the best things you’ve grown this year are the ones nobody else can see.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-17.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-17.webp"
      },
      {
        "title": "Fresh Starts This Thanksgiving",
        "group": "New Beginnings & Gratitude",
        "greeting": "May this season offer hope, gentler days, and room to begin again.",
        "wish": "Here’s to the first small step and the good things that can grow from it.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-18.webp",
        "inside": "https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/inside-18.webp"
      }
    ]
  },
  {
    "id": "thinking-of-you",
    "title": "Thinking of You",
    "cards": [
      {
        "title": "I Put the Group Chat in Timeout",
        "wish": "My phone is face down and everyone is still giving testimony. Want to walk around the block with me?",
        "greeting": "We can talk about it or rate the neighborhood dogs. Your call.",
        "cover": "/assets/thinking-of-you/card-01.webp",
        "inside": "/assets/thinking-of-you/inside-01.webp"
      },
      {
        "title": "I’m Glad You Told Me",
        "wish": "I’m glad you trusted me with what happened. Missing them makes sense. So does needing distance.",
        "greeting": "Want company tonight? We can put on something ridiculous and leave the talking for whenever you feel like it.",
        "cover": "/assets/thinking-of-you/cover.webp",
        "inside": "/assets/thinking-of-you/inside.webp"
      },
      {
        "title": "I Heard You the First Time",
        "wish": "You said it hurt and somehow your tone became the family’s main topic. I still wanted to hear the rest of what you were saying.",
        "greeting": "If you want to finish telling me, I’m here.",
        "cover": "/assets/thinking-of-you/card-03.webp",
        "inside": "/assets/thinking-of-you/inside-03.webp"
      },
      {
        "title": "You Told One Person",
        "wish": "By dinner, your private news had a distribution list. I’d feel hurt, too.",
        "greeting": "If you bring it up with me, I’ll ask before I share anything.",
        "cover": "/assets/thinking-of-you/card-04.webp",
        "inside": "/assets/thinking-of-you/inside-04.webp"
      },
      {
        "title": "Dinner Has a Service Fee Now?",
        "wish": "The app charged me for delivery, service, and apparently the privilege of looking at fries. I’m making toast.",
        "greeting": "Come hungry. I’ve got butter and two plates.",
        "cover": "/assets/thinking-of-you/card-05.webp",
        "inside": "/assets/thinking-of-you/inside-05.webp"
      },
      {
        "title": "Take Your Time. The Kettle’s On.",
        "wish": "Everyone has a version of what happened. You can take as long as you need to find the words for yours.",
        "greeting": "I’ve got tea and time if you want either.",
        "cover": "/assets/thinking-of-you/card-06.webp",
        "inside": "/assets/thinking-of-you/inside-06.webp"
      },
      {
        "title": "I Laughed. I Owe You an Apology.",
        "wish": "When they made you the joke, I laughed along. I’m sorry. Next time I’ll speak up in the room.",
        "greeting": "Take whatever space you need. I’ll follow your lead.",
        "cover": "/assets/thinking-of-you/card-07.webp",
        "inside": "/assets/thinking-of-you/inside-07.webp"
      },
      {
        "title": "I’m Glad You Left When You Needed To",
        "wish": "You looked worn out by the time you headed home. I hope you got a quiet minute to yourself.",
        "greeting": "If you want company somewhere quieter, I’ll put the kettle on.",
        "cover": "/assets/thinking-of-you/card-08.webp",
        "inside": "/assets/thinking-of-you/inside-08.webp"
      },
      {
        "title": "A Little Love From Over Here",
        "wish": "You asked me for space. I heard you. I’ll let you decide when you want to talk.",
        "greeting": "Thinking of you today. No reply needed.",
        "cover": "/assets/thinking-of-you/card-09.webp",
        "inside": "/assets/thinking-of-you/inside-09.webp"
      },
      {
        "title": "My Pajamas RSVP’d for Me",
        "wish": "After the extra shift and that trip across town, my pajamas put up a surprisingly strong argument.",
        "greeting": "I miss you. Pancakes Sunday, somewhere close to you?",
        "cover": "/assets/thinking-of-you/card-10.webp",
        "inside": "/assets/thinking-of-you/inside-10.webp"
      },
      {
        "title": "I’m Checking With You",
        "wish": "The group chat has three theories about how you’re doing. I figured you’d have the best information.",
        "greeting": "How’s today going? One word is plenty if that’s all you’ve got.",
        "cover": "/assets/thinking-of-you/card-11.webp",
        "inside": "/assets/thinking-of-you/inside-11.webp"
      },
      {
        "title": "Your Address Can Change. I’m Still Here.",
        "wish": "One rent notice and suddenly the whole apartment has to fit in boxes. I know how much that is to carry.",
        "greeting": "I can pack boxes or bring sandwiches Saturday. Which would help?",
        "cover": "/assets/thinking-of-you/card-12.webp",
        "inside": "/assets/thinking-of-you/inside-12.webp"
      },
      {
        "title": "Our Calendars Should Pay Rent",
        "wish": "They’ve been living together long enough. Meanwhile, I miss your actual face.",
        "greeting": "Ten minutes between shifts on our usual bench? I can bring coffee.",
        "cover": "/assets/thinking-of-you/card-13.webp",
        "inside": "/assets/thinking-of-you/inside-13.webp"
      },
      {
        "title": "Who Gave the Blender a Microphone?",
        "wish": "That kitchen got loud fast. Next time I can keep the blender off and set aside a quiet room.",
        "greeting": "What would make the visit easier for you? I’m happy to work with you.",
        "cover": "/assets/thinking-of-you/card-14.webp",
        "inside": "/assets/thinking-of-you/inside-14.webp"
      },
      {
        "title": "You Get a Say in the Plan",
        "wish": "We planned a whole day around you and forgot to ask what you wanted. I’m sorry. Let’s start there.",
        "greeting": "You pick the place, the time, or a different day. I’d love to see you.",
        "cover": "/assets/thinking-of-you/card-15.webp",
        "inside": "/assets/thinking-of-you/inside-15.webp"
      },
      {
        "title": "Can I Take One Thing Off Your List?",
        "wish": "I saw your schedule. By page two I was ready to offer the calendar a chair.",
        "greeting": "I can bring groceries Saturday or leave dinner at your door Wednesday. Pick whichever helps.",
        "cover": "/assets/thinking-of-you/card-16.webp",
        "inside": "/assets/thinking-of-you/inside-16.webp"
      },
      {
        "title": "I Cut You Off. I’m Listening Now.",
        "wish": "You were telling me what you needed, and I jumped in to defend myself. I’m sorry. I’d like to hear the rest whenever you feel up to it.",
        "greeting": "Text, talk, or take some time. I’ll follow your lead.",
        "cover": "/assets/thinking-of-you/card-17.webp",
        "inside": "/assets/thinking-of-you/inside-17.webp"
      },
      {
        "title": "Can We Make Pancakes a Tradition?",
        "wish": "I miss laughing in the kitchen with you. I think we could get that part back for about the cost of pancake mix.",
        "greeting": "Saturday breakfast at mine? You bring the music. I’ll make the pancakes.",
        "cover": "/assets/thinking-of-you/card-18.webp",
        "inside": "/assets/thinking-of-you/inside-18.webp"
      }
    ]
  },
  {
    "id": "motion",
    "title": "Motion Cards",
    "cards": [
      {
        "title": "Anniversary Motion Card",
        "greeting": "Happy anniversary. I’m so glad we get to do life together.",
        "wish": "Here’s to the memories we’ve made and the little moments still ahead of us.",
        "cover": "https://hugslinks-card-app.netlify.app/assets/anniversary/motion-poster.webp",
        "video": "https://cdn.pika.art/v2/media/creation_36956de0-2d4b-4915-9764-1dc3a18d73b3/output.mp4"
      },
      {
        "title": "NYC Ride",
        "greeting": "Sending you a little New York energy and a big HUG.",
        "wish": "Here’s a ride through the city with HUGS Bear.",
        "cover": "/assets/nyc-ride-hugs-card-cover.jpg",
        "video": "/assets/nyc-ride-hugs-full.mp4"
      }
    ]
  },
  {
    "id": "memorial",
    "title": "Remembrance",
    "cards": [
      {
        "title": "Always Remembered",
        "greeting": "Thinking of you and honoring the lives we remember.",
        "wish": "A HUG for the lives, courage, and communities we carry with us.",
        "cover": "/assets/memorial-hugs-card-cover.PNG",
        "inside": "/assets/hugs-community-911-memorial.png"
      }
    ]
  }
]];

export function getDesign(collection, index) {
  return collections.find(item => item.id === collection)?.cards[index];
}
