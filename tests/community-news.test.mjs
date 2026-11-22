import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, parseNonprofit, parseEvents } from '../netlify/lib/community-updates.mjs';
test('missing publication dates stay missing and unsafe links cannot execute', () => {
 const [item] = parseRss('<rss><item><title>Hello</title><link>javascript:alert(1)</link><description>Original report</description></item></rss>',{name:'Example',homepage:'https://example.org'},'news');
 assert.equal(item.published_at,''); assert.equal(item.source_url,'https://example.org');
 assert.equal(item.summary,'Read the publisher’s report at the original source.');
});
test('nonprofit cards retain organization dates without implying eligibility', () => {
 const [item] = parseNonprofit('<a class="article-card" href="/news/help"><h3>Community support</h3><p>November 9, 2026</p></a>');
 assert.equal(item.type,'nonprofit'); assert.match(item.published_at,/2026-11-09/); assert.equal(item.official,false);
});
test('past events are excluded and upcoming dates are separate from publication', () => {
 const html='<a href="/events/2026/11/15/old">Past activity</a><a href="/events/2026/11/17/new">New activity</a>';
 const events = parseEvents(html,new Date('2026-11-16T13:00:00Z'));
 assert.equal(events.length,1); assert.equal(events[0].event_date,'2026-11-17'); assert.equal(events[0].published_at,undefined);
});
