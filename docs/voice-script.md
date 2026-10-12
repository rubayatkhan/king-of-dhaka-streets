# Street voice script

These are the street voices in King of Dhaka Streets. Each line plays the family's recording when there is one, an AI placeholder voice when there isn't, and otherwise only its caption. You can record a few lines at a time; the game picks each one up as it lands.

## How to record

1. Find a quiet room with soft things around (curtains, a sofa). Turn off fans.
2. Use the phone's voice-memo app. Hold the phone about 30 cm from your mouth, a little to the side.
3. Say the line three times, with a short pause between takes. Act it: these are loud street calls, not reading aloud.
4. Name the file with the line's ID, for example `tea-vendor.m4a`, and send it over.
5. To add it to the game, run `npm run add-voice -- tea-vendor ~/Downloads/tea-vendor.m4a --credit "Ma"`. Pick the best take first if you recorded three. The script trims the silence, takes the edge off room noise, levels the volume and updates `public/audio/voices/manifest.json`.

**Credits are public.** This repository and the game's credits page are public. `--credit` is optional: use a name the family is happy to publish, or leave it out to be credited as "Family voice".

## Lines

### `bus-helper-plastic`
- **Bangla:** ওস্তাদ, বামে প্লাস্টিক!
- **Say it:** Ostad, baame plastic!
- **Meaning:** Boss, something small on the left!
- **How:** A bus helper hanging off the door, warning his driver over the traffic. Slap the side of a table twice first (thak-thak), then shout.

### `bus-route-gulistan`
- **Bangla:** গুলিস্তান! গুলিস্তান!
- **Say it:** Gulistan! Gulistan!
- **Meaning:** Gulistan! Gulistan!
- **How:** A bus helper calling the route, fast and sing-song, as if leaning out of the door.

### `bus-route-motijheel`
- **Bangla:** মতিঝিল! মতিঝিল! উঠেন, উঠেন!
- **Say it:** Motijheel! Motijheel! Uthen, uthen!
- **Meaning:** Motijheel! Hop on, hop on!
- **How:** A bus helper hurrying passengers on board, waving them in.

### `bus-route-farmgate`
- **Bangla:** ফার্মগেট! ফার্মগেট! খালি গাড়ি!
- **Say it:** Farmgate! Farmgate! Khali gari!
- **Meaning:** Farmgate! Empty bus!
- **How:** A bus helper bragging that there are seats left, loud and cheerful.

### `rickshaw-mama`
- **Bangla:** মামা, যাবেন?
- **Say it:** Mama, jaben?
- **Meaning:** Uncle, need a ride?
- **How:** A rickshaw-puller asking a passer-by, friendly and a little tired.

### `tea-vendor`
- **Bangla:** এই চা, গরম চা! খাইয়া যান, ভাই!
- **Say it:** Ei cha, gorom cha! Khaiya jan, bhai!
- **Meaning:** Hot tea! Have a cup, brother!
- **How:** A tea seller at a street stall, calling out over the clink of glasses.

### `badam-seller`
- **Bangla:** বাদাম! বাদাম! গরম বাদাম!
- **Say it:** Badam! Badam! Gorom badam!
- **Meaning:** Peanuts! Hot roasted peanuts!
- **How:** A peanut seller walking with a basket, a long call that rises at the end.

### `launch-caller`
- **Bangla:** সদরঘাট! সদরঘাট! লঞ্চ ছাইড়া দিবো, তাড়াতাড়ি আহেন!
- **Say it:** Sadarghat! Sadarghat! Launch chaira dibo, taratari ahen!
- **Meaning:** Sadarghat! The launch is leaving, hurry!
- **How:** A man at the river terminal shouting that the ferry is about to leave, urgent.

### `boatman-nouka`
- **Bangla:** নৌকা! নৌকা! পার হবেন?
- **Say it:** Nouka! Nouka! Par hoben?
- **Meaning:** Boat! Boat! Crossing over?
- **How:** A boatman calling from the river steps, relaxed and drawn out.

### `vegetable-vendor`
- **Bangla:** তাজা সবজি! লাউ লন, টমেটো লন!
- **Say it:** Taja shobji! Lau lon, tomato lon!
- **Meaning:** Fresh vegetables! Gourds, tomatoes!
- **How:** A vegetable seller at the wholesale market, brisk and loud.

### `auction-caller`
- **Bangla:** একশো! একশো দশ! আর কে?
- **Say it:** Eksho! Eksho dosh! Ar ke?
- **Meaning:** A hundred! A hundred and ten! Anyone else?
- **How:** A wholesale auctioneer taking bids, quick-fire and excited.

### `easy-brother`
- **Bangla:** আস্তে ভাই, একটু জায়গা দেন!
- **Say it:** Aste bhai, ektu jayga den!
- **Meaning:** Easy, brother, give a little room!
- **How:** Someone you only just squeezed past, annoyed but not angry.

### `crash-chokhe`
- **Bangla:** চোখে দেহো না মিয়া?!
- **Say it:** Chokhe deho na miya?!
- **Meaning:** Can't you see where you're going?!
- **How:** Someone you actually hit: more than a little annoyed, almost angry, shouting at the rider.

### `cha-ah`
- **Bangla:** আহ্!
- **Say it:** Aah!
- **Meaning:** Aah!
- **How:** One satisfied sigh after a sip of hot sweet tea.

### `pothole-uff`
- **Bangla:** উফ!
- **Say it:** Uff!
- **Meaning:** Oof!
- **How:** A short grunt as the wheel drops into a pothole.

### `stomach-gurgur`
- **Bangla:** পেট গুড়গুড়!
- **Say it:** Pet gurgur!
- **Meaning:** Tummy trouble!
- **How:** Funny and worried, holding your tummy, the second word wobbling.

### `near-miss-banchlam`
- **Bangla:** বাঁচলাম!
- **Say it:** Banchlam!
- **Meaning:** Phew, made it!
- **How:** Relieved and laughing after just squeezing past a bus.

### `crowd-king`
- **Bangla:** ঢাকার রাজা!
- **Say it:** Dhakar raja!
- **Meaning:** King of Dhaka!
- **How:** Everyone in the family shouting together, like a crowd cheering a champion.
