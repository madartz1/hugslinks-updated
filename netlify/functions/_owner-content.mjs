export const STORE_PRODUCTS = [
  {
    id:"send-a-hug",
    title:"Send a HUG",
    price:"$6.99",
    label:"Ready to Send",
    badge:"Animated HUGS Card",
    description:"Choose a finished animated HUGSLinks experience and send someone a meaningful digital HUG.",
    features:["Animated HUGS Card","Music and sound included","Ready to send","No personalization required","Preview before purchasing"],
    image_url:"assets/get-a-hug-envelope.png",
    preview_url:"nyc-ride-hugs-card.html",
    preview_text:"▶ View NYC Ride & Preview",
    cta_url:"https://buy.stripe.com/cNi4gy1yA0s00e30488ww04",
    cta_text:"Send This HUG — $6.99",
    style:"standard",
    published:true,
    sort_order:1
  },
  {
    id:"personalize-a-hug",
    title:"Personalize a HUG",
    price:"$16.99",
    label:"Personalized",
    badge:"Personalized HUG",
    description:"Make the experience personal with the recipient's name, your message, sender details and HUGS Bear.",
    features:["Recipient name","Personal message","Sender name","Occasion details","Features HUGS Bear"],
    image_url:"assets/hugs-open-envelope.png",
    preview_url:"",
    preview_text:"",
    cta_url:"personalized-hugs-card.html",
    cta_text:"Personalize a HUG — $16.99",
    style:"featured",
    published:true,
    sort_order:2
  },
  {
    id:"custom-hug-card",
    title:"Custom HUG Card",
    price:"From $39",
    label:"Custom",
    badge:"Premium",
    description:"Create a unique HUGSLinks visual experience built around a special person, occasion, message or story.",
    features:["Custom creative direction","Premium visual design","Custom message or story","Built around your idea","Ideal for special occasions"],
    image_url:"assets/get-a-hug-envelope.png",
    preview_url:"",
    preview_text:"",
    cta_url:"contact.html",
    cta_text:"Request a Custom HUG",
    style:"premium",
    published:true,
    sort_order:3
  }
];

export const REVIEW_BUSINESSES = [
  {
    id:"champion-pizza-flushing",
    name:"Champion Pizza",
    neighborhood:"Flushing, Queens",
    address:"136-31 Roosevelt Ave, Flushing, NY 11354",
    editorial_status:"HUGS Approved",
    description:"",
    published:true,
    sort_order:1
  }
];

export const PROJECTS = [
  {id:"hugs-cards",title:"HUGS Cards",description:"Browse digital, printable, motion-story and app-style HUGS Card experiences.",url:"hugs-cards.html",icon:"💌",status:"Live",link_text:"Explore HUGS Cards",category:"cards-commerce",featured:true,published:true,sort_order:1},
  {id:"create-hugs-card",title:"Create Your HUGS Card",description:"Build a personalized digital HUG with your message, design and recipient details.",url:"/app/create-card.html",icon:"✨",status:"Live",link_text:"Start creating",category:"cards-commerce",featured:false,published:true,sort_order:2},
  {id:"original-motion-hug",title:"Original Motion HUG",description:"View the original interactive card experience that inspired the first HUGS Card type.",url:"https://hugscard.netlify.app/",icon:"🎬",status:"Live demo",link_text:"View the motion card",category:"cards-commerce",featured:false,published:true,sort_order:3},
  {id:"hugslinks-shop",title:"HUGSLinks Shop",description:"Discover HUGSLinks cards, art-inspired products and meaningful merchandise.",url:"shop.html",icon:"🛍️",status:"Live",link_text:"Visit the shop",category:"cards-commerce",featured:false,published:true,sort_order:4},
  {id:"hugslinks-members",title:"HUGSLinks Members",description:"Enter the member experience for HUGSLinks benefits, access and updates.",url:"member.html",icon:"💙",status:"Member",link_text:"Member access",category:"cards-commerce",featured:false,published:true,sort_order:5},
  {id:"hl-art-gallery",title:"HL Art Gallery",description:"Experience the dedicated HUGSLinks art gallery, artist stories and community artwork.",url:"https://hugslinks-community-art.netlify.app/",icon:"🖼️",status:"Live gallery",link_text:"Enter the gallery",category:"creative",featured:true,published:true,sort_order:1},
  {id:"art-community",title:"Art & Community",description:"Discover creative programs, artist participation, voting and support campaigns.",url:"art-community.html",icon:"🎨",status:"Live",link_text:"Explore community art",category:"creative",featured:false,published:true,sort_order:2},
  {id:"hl-studio",title:"HL Studio",description:"Use the HUGSLinks creative workspace for design, media and project production.",url:"/studio/",icon:"🪄",status:"Live",link_text:"Open HL Studio",category:"creative",featured:false,published:true,sort_order:3},
  {id:"business-services",title:"Business Services",description:"Get help with creative setup, digital presence and practical business growth.",url:"business-services.html",icon:"💼",status:"Live",link_text:"View services",category:"creative",featured:false,published:true,sort_order:4},
  {id:"hugs-reviews",title:"HUGS Reviews",description:"Find thoughtful community-centered reviews and recognition for better local service.",url:"reviews.html",icon:"⭐",status:"Live",link_text:"Read HUGS Reviews",category:"creative",featured:false,published:true,sort_order:5},
  {id:"hugslinks-crypto",title:"HUGSLinks Crypto",description:"Explore the HUGSLinks digital innovation and community technology project.",url:"https://hugslinks-crypto.netlify.app/",icon:"🔗",status:"Project",link_text:"Visit the project",category:"creative",featured:false,published:true,sort_order:6},
  {id:"hugs-help-app",title:"HUGS Help App",description:"Start with the mobile-friendly support experience and connect to the help you need.",url:"help-app.html",icon:"🤝",status:"Live",link_text:"Open the Help App",category:"community",featured:true,published:true,sort_order:1},
  {id:"food-support",title:"Food Support",description:"Find food support information, local resources and partner pathways.",url:"food-support.html",icon:"🍎",status:"Live",link_text:"Find food support",category:"community",featured:false,published:true,sort_order:2},
  {id:"housing-help",title:"Housing Help",description:"Access housing navigation, advocacy information and practical next steps.",url:"housing-help.html",icon:"🏠",status:"Live",link_text:"Find housing help",category:"community",featured:false,published:true,sort_order:3},
  {id:"community-resources",title:"Community Resources",description:"Browse benefits, emergency, clothing, government and community resource pathways.",url:"resources.html",icon:"📚",status:"Live",link_text:"Browse resources",category:"community",featured:false,published:true,sort_order:4},
  {id:"nyc-updates",title:"HUGS NYC Updates",description:"See public alerts, programs, policy developments and selected local headlines.",url:"nyc-updates.html",icon:"🗽",status:"Live",link_text:"View NYC updates",category:"community",featured:false,published:true,sort_order:5},
  {id:"support-hugs",title:"Support HUGS",description:"Help HUGSLinks grow its creative and community support mission.",url:"support-hugs.html",icon:"💞",status:"Support",link_text:"Support the mission",category:"community",featured:false,published:true,sort_order:6}
];

export const clean = (value, max=1000) => typeof value === "string"
  ? value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max)
  : "";

export const validURL = value => {
  if(!value) return true;
  try{
    const url = new URL(value, "https://hugslinks.com");
    return ["http:","https:"].includes(url.protocol);
  }catch{return false}
};

export const slug = value => clean(value, 100)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g,"-")
  .replace(/(^-|-$)/g,"")
  .slice(0,80);

export default () => new Response("Not found", { status:404 });
