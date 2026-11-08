# Typography and document blocks

Inspect headings, nested lists, checkboxes, escapes, entities, wrapping, and source preservation. Switch between all three modes.

## Guarded indentation checks

Use Tab / Shift+Tab in Live Preview and Source. Undo between checks: the first item cannot indent/outdent; Lvl 2a cannot indent but can outdent (Lvl 2b then becomes its child); Lvl 2b can indent beneath Lvl 2a or outdent. Select children explicitly to move their parent. Invalid group edits must change nothing.

- Lvl 1
  - Lvl 2a
  - Lvl 2b

Try a mixed list: the numbered item can indent beneath the bullet without changing its marker.

- Bullet parent
1. Numbered child candidate

A wide ordered marker needs more than four spaces for a child. Tab on the second item must be blocked.

100. Wide parent
101. Cannot nest with four spaces

# Heading one

## Heading two

### Heading three

#### Heading four

##### Heading five

###### Heading six

Setext one
===========

Setext two
----------

A paragraph with **bold**, *italic*, ***combined emphasis***, ~~strikethrough~~, and `inline code`.

Escaped punctuation: \*literal stars\*, \[brackets\], \_underscores\_. Entities: &amp; &lt; &gt; &copy; &#169; &#x1F600;.

> A blockquote with **emphasis**.
>
> > A nested quote.

- First bullet
  - Nested bullet
    1. Mixed nested number
- Another bullet

7. Numbered list starts at seven
8. Next item

- [ ] An unchecked task
- [x] A completed task

---

This paragraph has a soft
line break and a hard break here.  
The hard-break continuation.

    const indentedCode = "literal Markdown **here**";

A long paragraph for wrapping: Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. Every visible line should stay reachable using arrows, mouse clicks, and drag selection. 
