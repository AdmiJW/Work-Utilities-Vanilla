# Markdown showcase

Inspect every supported element, then use the focused examples for detailed checks. All assets are embedded; no network access is needed.

## Indentation and cell-line checks

Try Tab / Shift+Tab on list items and code. List changes must respect preceding siblings, selected children, and valid four-space nesting. Undo between checks. In tables, check mouse caret placement, Up/Down entry at visible line ends, Left/Right across cell boundaries, and source-neutral navigation. Shift+Enter and multiline paste stay in a cell; Enter moves down.

| Line breaks | Inline code | Literal HTML |
| --- | --- | --- |
| First<br>Second<BR />Third | `split this code` | `literal<br>code` and \<br> |
| <br>Leading and trailing<br> | [Label](https://example.com) | <span>literal</span> |

Shift+Enter splits inline code into separate spans. Breaks inside destinations are blocked. Source mode shows the break tags; undo and mode changes preserve source spelling.

# Typography and document blocks

Inspect headings, nested lists, checkboxes, escapes, entities, wrapping, and source preservation. Switch between all three modes.

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
# Code languages

Inspect bundled highlighting and aliases; unsupported or unlabelled fences stay plain code. Markdown punctuation inside fences remains literal.

## sql

```sql
SELECT Id, Name FROM dbo.Customers WHERE Active = 1;
```

## javascript

```javascript
const value = { ready: true }; // JavaScript
```

## typescript

```typescript
const value: number = 42;
```

## json

```json
{"name":"offline","items":[1,2,3]}
```

## python

```python
def greet(name):
    return f"Hello, {name}"
```

## html

```html
<section class="example">Literal HTML code</section>
```

## css

```css
.example { color: blue; padding: 8px; }
```

### Alias js

```js
const value = { ready: true }; // JavaScript
```

### Alias jsx

```jsx
const value = { ready: true }; // JavaScript
```

### Alias ts

```ts
const value: number = 42;
```

### Alias tsx

```tsx
const value: number = 42;
```

### Alias py

```py
def greet(name):
    return f"Hello, {name}"
```

### Alias htm

```htm
<section class="example">Literal HTML code</section>
```

### Alias tsql

```tsql
SELECT Id, Name FROM dbo.Customers WHERE Active = 1;
```

### Alias mssql

```mssql
SELECT Id, Name FROM dbo.Customers WHERE Active = 1;
```


## C#

```cs
public sealed class Note
{
    public string Title { get; init; } = "Offline";
}
```

Aliases: `csharp` and `c#`.

## Bash

```bash
#!/usr/bin/env bash
for file in *.md; do
    printf "%s\n" "$file"
done
```

Aliases: `sh` and `shell`.

## Plain fallback

```unknown-language
**literal** [not a link](https://example.com)
<script>not executed</script>
```

```
Unlabelled plain code
```
# Visual tables

Click formatted text to place the caret. Try Up/Down through wrapped lines and rows, Tab/Shift+Tab, Enter, Escape, right-click cell controls (or Shift+F10), structural edits, and undo. Tab selects the entire next cell; Left/Right collapse its selection. Columns size automatically and paragraphs immediately below the table remain outside it. Navigation alone must not rewrite source.

| Left | Center | Right |
| :--- | :---: | ---: |
| **Bold** and *italic* | ~~Removed~~ | `code` |
| a\|b | &amp; &copy; | [Link](https://example.com) |
|  | Empty cells |  |
| Long wrapping text for vertical caret movement. Long wrapping text for vertical caret movement. Long wrapping text for vertical caret movement. Long wrapping text for vertical caret movement. Long wrapping text for vertical caret movement. Long wrapping text for vertical caret movement. Long wrapping text for vertical caret movement.  | Short | End |
| Missing trailing cells |

## Images in cells

| Image | Note |
| --- | --- |
| ![Small PNG](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAwCAYAAADab77TAAAFfUlEQVR4AeyaTWgdVRTHT14SkzQxTZNao4IWWhUpQl2YlVqxKK1CXRQqbgyoBFT8AI2gFoVSFzYW1CJCF0oEKaS4sKAVJWJ1FxcWRASxIG4M2rw0adLXmDbP+7vlDtOXyZubZF7auTmB82bm3HPPPff87/mYIYXxc+WyUrg+KIj+Be0BBThoeEUUYAU4cA8Evj2NYAU4cA8Evj2NYAU4SA+smk1pBAcOtQKsAAfugcC3pxGsAAfugcC3pxGsAAfugcC3pxG8ugAOfLercHuLiuAPj01Lz/OnI9r2ypicPDU7z23wGEOWORD38I7+WJKdbxTtvNHxOXl4b1G+/mlmno6sGP2HJwXKSl/e9HgBPHW+LL0DZ+TLkRk5tq9TRg6tt/T+M+3y4keTAoDxjX82XJKe2xqtzO57W+y8fU9cKyfe7ZJbb2yIRLvXFeSr/Z2y4+6miJf1zUBfu0BZ682LPi+AB785Z/cztHedAIp9MD9bNzUKIA/9cD6KQg7DPxNzsrG73kiIjBYvSrks0t3ptZSdoz/ZeSDV66RRIvfx+1ukrblu3sqATLQO/zwjyO7ZPy6//XVBBr8tyfZXx6TvvQkZm5yz18pUiXw8RZMJyBQHhqaiMsA4cm5hDhAypHyoctzJuStrQjw7/c8emoj0M4Z+9KAPipeMeLlhDGIO+hyhFz6Enrc+PWszHrYiw3UxNjMnK0oH2CMCt9/VJL8aUDGKKL/j5gbpfbBFhg90yeGX1kpXe8FefVIlh6PVHCTKwHcDXXLd2oIcPDqF6ugA9dx+Kf0j80hPkzx58Iwds0IpP+jfckuDLR/YNvL7rJ3/8csdlofdH3wxbfUB/OufnJXXHmuzY6xnS80v/0UZi8NABrO6TOl64dFWOR7rKdDBoV+OzSlbqjqcCjCz21rqTIq9lHJ5riWtN4BSt1mDjIFjSPlEwck/Zi3gvQ+tYdgS9xyCz03zZhkpP3H9m29qkI3X1wuHxJWeTTdU7xG2bm4UdLAMNh35viR77msWMhk8+oltd17DraUsbLaKlvjjBfBUqSzU0iWusahpgMWBSpp06u8LNv0/0D8WpVjuicok+SReNf1J8vAA0qXYXW8W5bTpMSzf+OVfcx8/FPBd/8F9FjajZ6mUCnB3Z73UmdI7WpxbcA3q7xaTll0ULCi4zIE/Ry8K6Z/UTbqM03O7WpehPXkq6ZWayiHaYDIL6/EW4SI4edbl3JW2+fLVJf3fZgGNFHbEpCJOcqUCmhDqGHW4cizrZyKDiCGjZK07SR/pFT6guv6BTDZtXhvhk2nICEQpz44A1d2vtM1uXXdNjWAEqXNcaRY41dxDgMt7MDWI2gOvluRqs2u6WAsb+IBCs8Nz1gSYgIpe9k7TVZox732GQY/A2wVNFnYYlm2+TpgmjHvoStjMuo68AGYjg/0dQodIDeJ1AAJc3oNrkR6dgfEr2YRul46d9SFew+hya3HA0MnhZQ3WYu9P7VhjywRlCdsqZejAd8Y+3Ky0zdgUJy+A3QQ2Qx1yxJcp1z06GXcYHOiMH3+7M+oy489sPv4lizkcJHQ4fZU8N8fZwBW7nHzlldQKwa/UxTqsB59xCF3YxDo8M8Yajnbf0yzMcTorZZi7oaMg1Gz0M44u+E4HV9ZhrNa0KIBrbUze9NOT0F3HP3yQqknZK9GT+PhLAfbx0gIyROg7T7fbjzykcKjPfLmrVclYwIyqbAW4qnvSB69k+k23zuM1yUeJyly9HqgewVev3WqZpwcUYE9H5VVMAc4rcp52K8CejsqrmAKcV+Q87VaAPR2VVzEFOK/IedqtAHs6Kq9iCnAScgHxFOCAwEzaigKc5JWAeApwQGAmbUUBTvJKQDwFOCAwk7byPwAAAP//Dbb7ZQAAAAZJREFUAwAjemUFNWPtVQAAAABJRU5ErkJggg==) | Image remains visible during cell editing. |

## Quoted table

> | Name | Value |
> | :--- | ---: |
> | Quoted | Preserves its prefix |

## Table in a list

- Container item

  | Name | Value |
  | --- | --- |
  | Listed | Nested table |
# Offline links, images, and literal content

Inspect all supported links and embedded images. Remote, relative, invalid images remain placeholders without network requests. Static HTML is rendered below; edit it in Source. Unsupported extensions remain literal.

[HTTPS](https://example.com) ? [HTTP](http://example.com) ? [Email](mailto:hello@example.com)

[Full reference][work] ? [work][] ? [work]

[work]: https://example.com/first "Reference title"
[work]: https://example.com/second

<https://example.com/angle> ? https://example.com/bare ? www.example.com ? <hello@example.com>

[Unsafe destination](javascript:alert(1)) remains source text.

![PNG with meaningful alt text](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAwCAYAAADab77TAAAFfUlEQVR4AeyaTWgdVRTHT14SkzQxTZNao4IWWhUpQl2YlVqxKK1CXRQqbgyoBFT8AI2gFoVSFzYW1CJCF0oEKaS4sKAVJWJ1FxcWRASxIG4M2rw0adLXmDbP+7vlDtOXyZubZF7auTmB82bm3HPPPff87/mYIYXxc+WyUrg+KIj+Be0BBThoeEUUYAU4cA8Evj2NYAU4cA8Evj2NYAU4SA+smk1pBAcOtQKsAAfugcC3pxGsAAfugcC3pxGsAAfugcC3pxG8ugAOfLercHuLiuAPj01Lz/OnI9r2ypicPDU7z23wGEOWORD38I7+WJKdbxTtvNHxOXl4b1G+/mlmno6sGP2HJwXKSl/e9HgBPHW+LL0DZ+TLkRk5tq9TRg6tt/T+M+3y4keTAoDxjX82XJKe2xqtzO57W+y8fU9cKyfe7ZJbb2yIRLvXFeSr/Z2y4+6miJf1zUBfu0BZ682LPi+AB785Z/cztHedAIp9MD9bNzUKIA/9cD6KQg7DPxNzsrG73kiIjBYvSrks0t3ptZSdoz/ZeSDV66RRIvfx+1ukrblu3sqATLQO/zwjyO7ZPy6//XVBBr8tyfZXx6TvvQkZm5yz18pUiXw8RZMJyBQHhqaiMsA4cm5hDhAypHyoctzJuStrQjw7/c8emoj0M4Z+9KAPipeMeLlhDGIO+hyhFz6Enrc+PWszHrYiw3UxNjMnK0oH2CMCt9/VJL8aUDGKKL/j5gbpfbBFhg90yeGX1kpXe8FefVIlh6PVHCTKwHcDXXLd2oIcPDqF6ugA9dx+Kf0j80hPkzx58Iwds0IpP+jfckuDLR/YNvL7rJ3/8csdlofdH3wxbfUB/OufnJXXHmuzY6xnS80v/0UZi8NABrO6TOl64dFWOR7rKdDBoV+OzSlbqjqcCjCz21rqTIq9lHJ5riWtN4BSt1mDjIFjSPlEwck/Zi3gvQ+tYdgS9xyCz03zZhkpP3H9m29qkI3X1wuHxJWeTTdU7xG2bm4UdLAMNh35viR77msWMhk8+oltd17DraUsbLaKlvjjBfBUqSzU0iWusahpgMWBSpp06u8LNv0/0D8WpVjuicok+SReNf1J8vAA0qXYXW8W5bTpMSzf+OVfcx8/FPBd/8F9FjajZ6mUCnB3Z73UmdI7WpxbcA3q7xaTll0ULCi4zIE/Ry8K6Z/UTbqM03O7WpehPXkq6ZWayiHaYDIL6/EW4SI4edbl3JW2+fLVJf3fZgGNFHbEpCJOcqUCmhDqGHW4cizrZyKDiCGjZK07SR/pFT6guv6BTDZtXhvhk2nICEQpz44A1d2vtM1uXXdNjWAEqXNcaRY41dxDgMt7MDWI2gOvluRqs2u6WAsb+IBCs8Nz1gSYgIpe9k7TVZox732GQY/A2wVNFnYYlm2+TpgmjHvoStjMuo68AGYjg/0dQodIDeJ1AAJc3oNrkR6dgfEr2YRul46d9SFew+hya3HA0MnhZQ3WYu9P7VhjywRlCdsqZejAd8Y+3Ky0zdgUJy+A3QQ2Qx1yxJcp1z06GXcYHOiMH3+7M+oy489sPv4lizkcJHQ4fZU8N8fZwBW7nHzlldQKwa/UxTqsB59xCF3YxDo8M8Yajnbf0yzMcTorZZi7oaMg1Gz0M44u+E4HV9ZhrNa0KIBrbUze9NOT0F3HP3yQqknZK9GT+PhLAfbx0gIyROg7T7fbjzykcKjPfLmrVclYwIyqbAW4qnvSB69k+k23zuM1yUeJyly9HqgewVev3WqZpwcUYE9H5VVMAc4rcp52K8CejsqrmAKcV+Q87VaAPR2VVzEFOK/IedqtAHs6Kq9iCnAScgHxFOCAwEzaigKc5JWAeApwQGAmbUUBTvJKQDwFOCAwk7byPwAAAP//Dbb7ZQAAAAZJREFUAwAjemUFNWPtVQAAAABJRU5ErkJggg==)

![JPEG image](data:image/jpeg;base64,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)

![Referenced image][picture]

[picture]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAwCAYAAADab77TAAAFfUlEQVR4AeyaTWgdVRTHT14SkzQxTZNao4IWWhUpQl2YlVqxKK1CXRQqbgyoBFT8AI2gFoVSFzYW1CJCF0oEKaS4sKAVJWJ1FxcWRASxIG4M2rw0adLXmDbP+7vlDtOXyZubZF7auTmB82bm3HPPPff87/mYIYXxc+WyUrg+KIj+Be0BBThoeEUUYAU4cA8Evj2NYAU4cA8Evj2NYAU4SA+smk1pBAcOtQKsAAfugcC3pxGsAAfugcC3pxGsAAfugcC3pxG8ugAOfLercHuLiuAPj01Lz/OnI9r2ypicPDU7z23wGEOWORD38I7+WJKdbxTtvNHxOXl4b1G+/mlmno6sGP2HJwXKSl/e9HgBPHW+LL0DZ+TLkRk5tq9TRg6tt/T+M+3y4keTAoDxjX82XJKe2xqtzO57W+y8fU9cKyfe7ZJbb2yIRLvXFeSr/Z2y4+6miJf1zUBfu0BZ682LPi+AB785Z/cztHedAIp9MD9bNzUKIA/9cD6KQg7DPxNzsrG73kiIjBYvSrks0t3ptZSdoz/ZeSDV66RRIvfx+1ukrblu3sqATLQO/zwjyO7ZPy6//XVBBr8tyfZXx6TvvQkZm5yz18pUiXw8RZMJyBQHhqaiMsA4cm5hDhAypHyoctzJuStrQjw7/c8emoj0M4Z+9KAPipeMeLlhDGIO+hyhFz6Enrc+PWszHrYiw3UxNjMnK0oH2CMCt9/VJL8aUDGKKL/j5gbpfbBFhg90yeGX1kpXe8FefVIlh6PVHCTKwHcDXXLd2oIcPDqF6ugA9dx+Kf0j80hPkzx58Iwds0IpP+jfckuDLR/YNvL7rJ3/8csdlofdH3wxbfUB/OufnJXXHmuzY6xnS80v/0UZi8NABrO6TOl64dFWOR7rKdDBoV+OzSlbqjqcCjCz21rqTIq9lHJ5riWtN4BSt1mDjIFjSPlEwck/Zi3gvQ+tYdgS9xyCz03zZhkpP3H9m29qkI3X1wuHxJWeTTdU7xG2bm4UdLAMNh35viR77msWMhk8+oltd17DraUsbLaKlvjjBfBUqSzU0iWusahpgMWBSpp06u8LNv0/0D8WpVjuicok+SReNf1J8vAA0qXYXW8W5bTpMSzf+OVfcx8/FPBd/8F9FjajZ6mUCnB3Z73UmdI7WpxbcA3q7xaTll0ULCi4zIE/Ry8K6Z/UTbqM03O7WpehPXkq6ZWayiHaYDIL6/EW4SI4edbl3JW2+fLVJf3fZgGNFHbEpCJOcqUCmhDqGHW4cizrZyKDiCGjZK07SR/pFT6guv6BTDZtXhvhk2nICEQpz44A1d2vtM1uXXdNjWAEqXNcaRY41dxDgMt7MDWI2gOvluRqs2u6WAsb+IBCs8Nz1gSYgIpe9k7TVZox732GQY/A2wVNFnYYlm2+TpgmjHvoStjMuo68AGYjg/0dQodIDeJ1AAJc3oNrkR6dgfEr2YRul46d9SFew+hya3HA0MnhZQ3WYu9P7VhjywRlCdsqZejAd8Y+3Ky0zdgUJy+A3QQ2Qx1yxJcp1z06GXcYHOiMH3+7M+oy489sPv4lizkcJHQ4fZU8N8fZwBW7nHzlldQKwa/UxTqsB59xCF3YxDo8M8Yajnbf0yzMcTorZZi7oaMg1Gz0M44u+E4HV9ZhrNa0KIBrbUze9NOT0F3HP3yQqknZK9GT+PhLAfbx0gIyROg7T7fbjzykcKjPfLmrVclYwIyqbAW4qnvSB69k+k23zuM1yUeJyly9HqgewVev3WqZpwcUYE9H5VVMAc4rcp52K8CejsqrmAKcV+Q87VaAPR2VVzEFOK/IedqtAHs6Kq9iCnAScgHxFOCAwEzaigKc5JWAeApwQGAmbUUBTvJKQDwFOCAwk7byPwAAAP//Dbb7ZQAAAAZJREFUAwAjemUFNWPtVQAAAABJRU5ErkJggg==

![Remote](https://offline-image.invalid/image.png)

![Relative](images/local.png)

![Invalid image](data:image/png;base64,AAAA)

<script>window.thisMustNeverExecute = true;</script>

<div style="padding: 12px; border: 1px solid #789; color: #467"><p>Static HTML with <strong>nested content</strong>. Delete this entire root in Live Preview, or edit it in Source.</p><details><summary>Expand details</summary><p>No scripts or external resources are needed.</p></details></div>

<table><tr><th>HTML table</th><th>Source edits only</th></tr><tr><td>Static content</td><td>Markdown table menus do not apply here.</td></tr></table>

Math is outside this version: $a^2 + b^2$. Wiki links remain literal: [[A note]].
