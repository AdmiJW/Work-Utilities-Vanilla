# Visual tables

Click formatted text to place the caret. Try Up/Down through wrapped lines and rows, Tab/Shift+Tab, Enter, Escape, alignment controls, structural edits, and undo. Navigation alone must not rewrite source.

## Cell line breaks and boundaries

Inspect the rendered breaks below. Enter a cell from above/below and check the caret at the first/last visible line end. At text boundaries, Left/Right wrap across columns and rows without changing source. Tab creates a row only after the final cell. Shift+Enter and pasted multiline text stay inside one cell; undo restores the entire edit.

| Explicit lines | Blank lines | Literal tokens |
| --- | --- | --- |
| First<br>Second<br />Third | <br>Middle<br><br>Last<br> | `code<br>literal` and \<br> |
| **Formatting**<BR />after break | `split this code` | [Label](https://example.com) |

Use Shift+Enter inside the code span: it becomes two code spans on separate lines. Try a break inside the link destination: the cell must remain unchanged and show an explanation.

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
