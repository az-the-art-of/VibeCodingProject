const sampleUsers = [
  {
    name: "Ava Nolan",
    email: "admin@localsocial.test",
    password: "admin123",
    role: "admin"
  },
  {
    name: "Mia Byrne",
    email: "mia@localsocial.test",
    password: "mia123",
    role: "user"
  },
  {
    name: "Liam Kelly",
    email: "liam@localsocial.test",
    password: "liam123",
    role: "user"
  }
];

const sampleClubs = [
  {
    name: "Riverside Running Club",
    activity_type: "Running",
    category: "Sports",
    location: "Dublin City Centre",
    age_group: "Adults",
    cost_type: "Free",
    setting_type: "Outdoor",
    meeting_frequency: "Weekly",
    description: "A welcoming evening running group for all paces, with 5 km and 8 km routes along the river.",
    address: "Meeting Point: Ha'penny Bridge, Dublin 1",
    meeting_time: "Tuesdays at 18:30",
    contact_email: "hello@riversiderunning.ie",
    image_url: "/images/running.svg"
  },
  {
    name: "Northside Book Circle",
    activity_type: "Book Club",
    category: "Literature",
    location: "Drumcondra",
    age_group: "Adults",
    cost_type: "Free",
    setting_type: "Indoor",
    meeting_frequency: "Monthly",
    description: "A relaxed book club focused on contemporary fiction, memoir, and accessible non-fiction.",
    address: "Drumcondra Community Library, Dublin 9",
    meeting_time: "First Thursday of each month at 19:00",
    contact_email: "books@northsidecircle.ie",
    image_url: "/images/books.svg"
  },
  {
    name: "Harbour Voices Choir",
    activity_type: "Choir",
    category: "Music",
    location: "Dun Laoghaire",
    age_group: "All Ages",
    cost_type: "Paid",
    setting_type: "Indoor",
    meeting_frequency: "Weekly",
    description: "Community choir singing modern classics, folk songs, and seasonal performances with no auditions required.",
    address: "Mariners Hall, Dun Laoghaire, Co. Dublin",
    meeting_time: "Mondays at 19:30",
    contact_email: "join@harbourvoices.ie",
    image_url: "/images/music.svg"
  },
  {
    name: "Saturday Board Game Social",
    activity_type: "Board Games",
    category: "Games",
    location: "Smithfield",
    age_group: "Young Adults",
    cost_type: "Paid",
    setting_type: "Indoor",
    meeting_frequency: "Weekly",
    description: "A social tabletop evening featuring gateway games, strategy titles, and drop-in friendly hosts.",
    address: "The Dice Room, Smithfield, Dublin 7",
    meeting_time: "Saturdays at 17:00",
    contact_email: "play@saturdayboards.ie",
    image_url: "/images/games.svg"
  },
  {
    name: "Phoenix Park Yoga Collective",
    activity_type: "Yoga",
    category: "Wellness",
    location: "Phoenix Park",
    age_group: "Adults",
    cost_type: "Paid",
    setting_type: "Outdoor",
    meeting_frequency: "Weekly",
    description: "Small-group yoga sessions in the park focused on movement, breathing, and low-pressure social connection.",
    address: "People's Gardens, Phoenix Park, Dublin 8",
    meeting_time: "Sundays at 10:00",
    contact_email: "namaste@phoenixyoga.ie",
    image_url: "/images/wellness.svg"
  },
  {
    name: "Eastside Makers Guild",
    activity_type: "Craft & Making",
    category: "Creative",
    location: "Ringsend",
    age_group: "Adults",
    cost_type: "Paid",
    setting_type: "Indoor",
    meeting_frequency: "Biweekly",
    description: "Hands-on sessions for crafts, simple woodworking, and shared making projects in a beginner-friendly workshop.",
    address: "Ringsend Workshop Hub, Dublin 4",
    meeting_time: "Every second Wednesday at 18:45",
    contact_email: "makers@eastsideguild.ie",
    image_url: "/images/creative.svg"
  },
  {
    name: "Bray Coastal Walkers",
    activity_type: "Walking Group",
    category: "Outdoors",
    location: "Bray",
    age_group: "All Ages",
    cost_type: "Free",
    setting_type: "Outdoor",
    meeting_frequency: "Weekly",
    description: "Weekend walks along the seafront and nearby trails with coffee afterwards for new and returning members.",
    address: "Bray Seafront Bandstand, Co. Wicklow",
    meeting_time: "Saturdays at 09:30",
    contact_email: "walk@braycoastal.ie",
    image_url: "/images/outdoors.svg"
  },
  {
    name: "Southside Photography Walks",
    activity_type: "Photography",
    category: "Creative",
    location: "Ranelagh",
    age_group: "Adults",
    cost_type: "Free",
    setting_type: "Hybrid",
    meeting_frequency: "Monthly",
    description: "Monthly themed photo walks plus occasional indoor editing meetups for hobby photographers.",
    address: "Meet outside Ranelagh LUAS Stop, Dublin 6",
    meeting_time: "Second Sunday of each month at 11:00",
    contact_email: "hello@southsidephotos.ie",
    image_url: "/images/photography.svg"
  },
  {
    name: "Community Garden Friends",
    activity_type: "Gardening",
    category: "Community",
    location: "Tallaght",
    age_group: "Families",
    cost_type: "Free",
    setting_type: "Outdoor",
    meeting_frequency: "Weekly",
    description: "Neighbour-led gardening sessions, seasonal planting, and practical workshops for families and new growers.",
    address: "Tallaght Community Garden, Dublin 24",
    meeting_time: "Wednesdays at 17:30",
    contact_email: "grow@communitygardenfriends.ie",
    image_url: "/images/community.svg"
  },
  {
    name: "Tech for Good Meetup",
    activity_type: "Coding & Digital Skills",
    category: "Technology",
    location: "Grand Canal Dock",
    age_group: "Adults",
    cost_type: "Free",
    setting_type: "Indoor",
    meeting_frequency: "Monthly",
    description: "Talks and informal networking for people interested in civic tech, digital inclusion, and volunteer coding projects.",
    address: "Docklands Innovation Centre, Dublin 2",
    meeting_time: "Last Tuesday of each month at 18:30",
    contact_email: "team@techforgood.ie",
    image_url: "/images/technology.svg"
  },
  {
    name: "Silver Circle Social Club",
    activity_type: "Tea & Activities",
    category: "Community",
    location: "Malahide",
    age_group: "Seniors",
    cost_type: "Free",
    setting_type: "Indoor",
    meeting_frequency: "Weekly",
    description: "Friendly weekday gatherings for older adults with games, guest speakers, and light exercise sessions.",
    address: "Malahide Parish Hall, Co. Dublin",
    meeting_time: "Thursdays at 14:00",
    contact_email: "welcome@silvercircle.ie",
    image_url: "/images/community.svg"
  },
  {
    name: "Language Exchange Hub",
    activity_type: "Language Exchange",
    category: "Learning",
    location: "Portobello",
    age_group: "Young Adults",
    cost_type: "Paid",
    setting_type: "Hybrid",
    meeting_frequency: "Weekly",
    description: "Structured conversation tables for English, Spanish, French, and Irish with rotating hosts and topic prompts.",
    address: "Portobello Community Space, Dublin 8",
    meeting_time: "Fridays at 19:00",
    contact_email: "speak@languagehub.ie",
    image_url: "/images/language.svg"
  }
];

module.exports = {
  sampleClubs,
  sampleUsers
};
