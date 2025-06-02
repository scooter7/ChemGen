// app/_components/marketing-content/archetypeData.ts
export interface Archetype {
  name: string;
  description: string; 
  keywords: string;    
  color: string;       
}

export const samfordClientArchetypes: Archetype[] = [
  {
    name: "Established Leader",
    description: "Powerful and assertive, driven by growth and being an industry leader. Samford's 175-year history is one of academic excellence and leadership. Samford increases its influence by graduating students capable of addressing the profound challenges facing today's society. Samford's strong character positions us as a place of hope and as a guiding light for future generations of thoughtful leaders.",
    keywords: "LEADER, ESTABLISHED, EMPOWERING, DEDICATED, TRADITIONAL, INTELLIGENT, EXPERIENTIAL, CONFIDENT, FORWARD-THINKING",
    color: "#303F9F", // Dark Blue
  },
  {
    name: "Classic Inspirer",
    description: "Beautiful and refined, driven by experience, sophistication and beauty in all forms. At Samford, the beauty of God's creation that surrounds us inspires us to be our best selves. Beauty is found on our nationally recognized campus, in the architecture, and in the lush greenery. Most importantly, beauty is found, and nurtured, within the hearts and minds of our students. Our learning environment enriches the spiritual, intellectual and social development. We manifest the beauty found at Samford by restoring hope to a broken world.",
    keywords: "BEAUTIFUL, INSPIRING, CLASSIC, DISTINCTIVE, REFINED, EXCELLENCE",
    color: "#E1BEE7", // Light Pink/Lavender
  },
  {
    name: "Loyal Shepherd",
    description: "Supportive and selfless, driven by compassion, warmth and the desire to care for others. Samford is a welcoming and caring community. Christ's love and selfless example compel our culture of service and compassion. Community service, campus fellowship and classroom learning encourage us to focus our gifts on a world in need. Relationships develop and strengthen through research opportunities and scholarly collaboration.",
    keywords: "LOYAL, COMPASSIONATE, CARING, WARM, ETHICAL, FRIENDLY, SUPPORTIVE, SELFLESS",
    color: "#5A2D82", // Deep Purple
  },
];