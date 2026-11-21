import { dependencies, makeHandler } from './_shared/hugs-card-links.mjs';
export default async request => makeHandler(dependencies())(request);
