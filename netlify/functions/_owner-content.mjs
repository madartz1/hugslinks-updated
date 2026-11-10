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
