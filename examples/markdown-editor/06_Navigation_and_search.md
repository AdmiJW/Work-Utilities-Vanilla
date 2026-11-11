# Navigation and search regression

Use Up/Down from the beginning and end, Shift+arrows in ordinary text, mouse clicks and drags, and Find with case/whole-word/regex. Search for needle. Check that Source export stays unchanged while navigating.

## Section 1

Paragraph 1: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 2

Paragraph 2: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 3

Paragraph 3: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

| Key | Detail |
| --- | ---: |
| Row 3 | needle in a cell |
| Ragged |

---

## Section 4

Paragraph 4: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

```js
const section = 4; // needle
```

## Section 5

Paragraph 5: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 6

Paragraph 6: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

| Key | Detail |
| --- | ---: |
| Row 6 | needle in a cell |
| Ragged |

---

![Offline marker 6](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAwCAYAAADab77TAAAFfUlEQVR4AeyaTWgdVRTHT14SkzQxTZNao4IWWhUpQl2YlVqxKK1CXRQqbgyoBFT8AI2gFoVSFzYW1CJCF0oEKaS4sKAVJWJ1FxcWRASxIG4M2rw0adLXmDbP+7vlDtOXyZubZF7auTmB82bm3HPPPff87/mYIYXxc+WyUrg+KIj+Be0BBThoeEUUYAU4cA8Evj2NYAU4cA8Evj2NYAU4SA+smk1pBAcOtQKsAAfugcC3pxGsAAfugcC3pxGsAAfugcC3pxG8ugAOfLercHuLiuAPj01Lz/OnI9r2ypicPDU7z23wGEOWORD38I7+WJKdbxTtvNHxOXl4b1G+/mlmno6sGP2HJwXKSl/e9HgBPHW+LL0DZ+TLkRk5tq9TRg6tt/T+M+3y4keTAoDxjX82XJKe2xqtzO57W+y8fU9cKyfe7ZJbb2yIRLvXFeSr/Z2y4+6miJf1zUBfu0BZ682LPi+AB785Z/cztHedAIp9MD9bNzUKIA/9cD6KQg7DPxNzsrG73kiIjBYvSrks0t3ptZSdoz/ZeSDV66RRIvfx+1ukrblu3sqATLQO/zwjyO7ZPy6//XVBBr8tyfZXx6TvvQkZm5yz18pUiXw8RZMJyBQHhqaiMsA4cm5hDhAypHyoctzJuStrQjw7/c8emoj0M4Z+9KAPipeMeLlhDGIO+hyhFz6Enrc+PWszHrYiw3UxNjMnK0oH2CMCt9/VJL8aUDGKKL/j5gbpfbBFhg90yeGX1kpXe8FefVIlh6PVHCTKwHcDXXLd2oIcPDqF6ugA9dx+Kf0j80hPkzx58Iwds0IpP+jfckuDLR/YNvL7rJ3/8csdlofdH3wxbfUB/OufnJXXHmuzY6xnS80v/0UZi8NABrO6TOl64dFWOR7rKdDBoV+OzSlbqjqcCjCz21rqTIq9lHJ5riWtN4BSt1mDjIFjSPlEwck/Zi3gvQ+tYdgS9xyCz03zZhkpP3H9m29qkI3X1wuHxJWeTTdU7xG2bm4UdLAMNh35viR77msWMhk8+oltd17DraUsbLaKlvjjBfBUqSzU0iWusahpgMWBSpp06u8LNv0/0D8WpVjuicok+SReNf1J8vAA0qXYXW8W5bTpMSzf+OVfcx8/FPBd/8F9FjajZ6mUCnB3Z73UmdI7WpxbcA3q7xaTll0ULCi4zIE/Ry8K6Z/UTbqM03O7WpehPXkq6ZWayiHaYDIL6/EW4SI4edbl3JW2+fLVJf3fZgGNFHbEpCJOcqUCmhDqGHW4cizrZyKDiCGjZK07SR/pFT6guv6BTDZtXhvhk2nICEQpz44A1d2vtM1uXXdNjWAEqXNcaRY41dxDgMt7MDWI2gOvluRqs2u6WAsb+IBCs8Nz1gSYgIpe9k7TVZox732GQY/A2wVNFnYYlm2+TpgmjHvoStjMuo68AGYjg/0dQodIDeJ1AAJc3oNrkR6dgfEr2YRul46d9SFew+hya3HA0MnhZQ3WYu9P7VhjywRlCdsqZejAd8Y+3Ky0zdgUJy+A3QQ2Qx1yxJcp1z06GXcYHOiMH3+7M+oy489sPv4lizkcJHQ4fZU8N8fZwBW7nHzlldQKwa/UxTqsB59xCF3YxDo8M8Yajnbf0yzMcTorZZi7oaMg1Gz0M44u+E4HV9ZhrNa0KIBrbUze9NOT0F3HP3yQqknZK9GT+PhLAfbx0gIyROg7T7fbjzykcKjPfLmrVclYwIyqbAW4qnvSB69k+k23zuM1yUeJyly9HqgewVev3WqZpwcUYE9H5VVMAc4rcp52K8CejsqrmAKcV+Q87VaAPR2VVzEFOK/IedqtAHs6Kq9iCnAScgHxFOCAwEzaigKc5JWAeApwQGAmbUUBTvJKQDwFOCAwk7byPwAAAP//Dbb7ZQAAAAZJREFUAwAjemUFNWPtVQAAAABJRU5ErkJggg==)

## Section 7

Paragraph 7: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 8

Paragraph 8: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

```js
const section = 8; // needle
```

## Section 9

Paragraph 9: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

| Key | Detail |
| --- | ---: |
| Row 9 | needle in a cell |
| Ragged |

---

## Section 10

Paragraph 10: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 11

Paragraph 11: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 12

Paragraph 12: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

| Key | Detail |
| --- | ---: |
| Row 12 | needle in a cell |
| Ragged |

---

```js
const section = 12; // needle
```

![Offline marker 12](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAwCAYAAADab77TAAAFfUlEQVR4AeyaTWgdVRTHT14SkzQxTZNao4IWWhUpQl2YlVqxKK1CXRQqbgyoBFT8AI2gFoVSFzYW1CJCF0oEKaS4sKAVJWJ1FxcWRASxIG4M2rw0adLXmDbP+7vlDtOXyZubZF7auTmB82bm3HPPPff87/mYIYXxc+WyUrg+KIj+Be0BBThoeEUUYAU4cA8Evj2NYAU4cA8Evj2NYAU4SA+smk1pBAcOtQKsAAfugcC3pxGsAAfugcC3pxGsAAfugcC3pxG8ugAOfLercHuLiuAPj01Lz/OnI9r2ypicPDU7z23wGEOWORD38I7+WJKdbxTtvNHxOXl4b1G+/mlmno6sGP2HJwXKSl/e9HgBPHW+LL0DZ+TLkRk5tq9TRg6tt/T+M+3y4keTAoDxjX82XJKe2xqtzO57W+y8fU9cKyfe7ZJbb2yIRLvXFeSr/Z2y4+6miJf1zUBfu0BZ682LPi+AB785Z/cztHedAIp9MD9bNzUKIA/9cD6KQg7DPxNzsrG73kiIjBYvSrks0t3ptZSdoz/ZeSDV66RRIvfx+1ukrblu3sqATLQO/zwjyO7ZPy6//XVBBr8tyfZXx6TvvQkZm5yz18pUiXw8RZMJyBQHhqaiMsA4cm5hDhAypHyoctzJuStrQjw7/c8emoj0M4Z+9KAPipeMeLlhDGIO+hyhFz6Enrc+PWszHrYiw3UxNjMnK0oH2CMCt9/VJL8aUDGKKL/j5gbpfbBFhg90yeGX1kpXe8FefVIlh6PVHCTKwHcDXXLd2oIcPDqF6ugA9dx+Kf0j80hPkzx58Iwds0IpP+jfckuDLR/YNvL7rJ3/8csdlofdH3wxbfUB/OufnJXXHmuzY6xnS80v/0UZi8NABrO6TOl64dFWOR7rKdDBoV+OzSlbqjqcCjCz21rqTIq9lHJ5riWtN4BSt1mDjIFjSPlEwck/Zi3gvQ+tYdgS9xyCz03zZhkpP3H9m29qkI3X1wuHxJWeTTdU7xG2bm4UdLAMNh35viR77msWMhk8+oltd17DraUsbLaKlvjjBfBUqSzU0iWusahpgMWBSpp06u8LNv0/0D8WpVjuicok+SReNf1J8vAA0qXYXW8W5bTpMSzf+OVfcx8/FPBd/8F9FjajZ6mUCnB3Z73UmdI7WpxbcA3q7xaTll0ULCi4zIE/Ry8K6Z/UTbqM03O7WpehPXkq6ZWayiHaYDIL6/EW4SI4edbl3JW2+fLVJf3fZgGNFHbEpCJOcqUCmhDqGHW4cizrZyKDiCGjZK07SR/pFT6guv6BTDZtXhvhk2nICEQpz44A1d2vtM1uXXdNjWAEqXNcaRY41dxDgMt7MDWI2gOvluRqs2u6WAsb+IBCs8Nz1gSYgIpe9k7TVZox732GQY/A2wVNFnYYlm2+TpgmjHvoStjMuo68AGYjg/0dQodIDeJ1AAJc3oNrkR6dgfEr2YRul46d9SFew+hya3HA0MnhZQ3WYu9P7VhjywRlCdsqZejAd8Y+3Ky0zdgUJy+A3QQ2Qx1yxJcp1z06GXcYHOiMH3+7M+oy489sPv4lizkcJHQ4fZU8N8fZwBW7nHzlldQKwa/UxTqsB59xCF3YxDo8M8Yajnbf0yzMcTorZZi7oaMg1Gz0M44u+E4HV9ZhrNa0KIBrbUze9NOT0F3HP3yQqknZK9GT+PhLAfbx0gIyROg7T7fbjzykcKjPfLmrVclYwIyqbAW4qnvSB69k+k23zuM1yUeJyly9HqgewVev3WqZpwcUYE9H5VVMAc4rcp52K8CejsqrmAKcV+Q87VaAPR2VVzEFOK/IedqtAHs6Kq9iCnAScgHxFOCAwEzaigKc5JWAeApwQGAmbUUBTvJKQDwFOCAwk7byPwAAAP//Dbb7ZQAAAAZJREFUAwAjemUFNWPtVQAAAABJRU5ErkJggg==)

## Section 13

Paragraph 13: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 14

Paragraph 14: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 15

Paragraph 15: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

| Key | Detail |
| --- | ---: |
| Row 15 | needle in a cell |
| Ragged |

---

## Section 16

Paragraph 16: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

```js
const section = 16; // needle
```

## Section 17

Paragraph 17: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

## Section 18

Paragraph 18: needle NEEDLE needles. Visible wrapped text with **bold**, *emphasis*, and a [link](https://example.com). 

| Key | Detail |
| --- | ---: |
| Row 18 | needle in a cell |
| Ragged |

---

![Offline marker 18](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAwCAYAAADab77TAAAFfUlEQVR4AeyaTWgdVRTHT14SkzQxTZNao4IWWhUpQl2YlVqxKK1CXRQqbgyoBFT8AI2gFoVSFzYW1CJCF0oEKaS4sKAVJWJ1FxcWRASxIG4M2rw0adLXmDbP+7vlDtOXyZubZF7auTmB82bm3HPPPff87/mYIYXxc+WyUrg+KIj+Be0BBThoeEUUYAU4cA8Evj2NYAU4cA8Evj2NYAU4SA+smk1pBAcOtQKsAAfugcC3pxGsAAfugcC3pxGsAAfugcC3pxG8ugAOfLercHuLiuAPj01Lz/OnI9r2ypicPDU7z23wGEOWORD38I7+WJKdbxTtvNHxOXl4b1G+/mlmno6sGP2HJwXKSl/e9HgBPHW+LL0DZ+TLkRk5tq9TRg6tt/T+M+3y4keTAoDxjX82XJKe2xqtzO57W+y8fU9cKyfe7ZJbb2yIRLvXFeSr/Z2y4+6miJf1zUBfu0BZ682LPi+AB785Z/cztHedAIp9MD9bNzUKIA/9cD6KQg7DPxNzsrG73kiIjBYvSrks0t3ptZSdoz/ZeSDV66RRIvfx+1ukrblu3sqATLQO/zwjyO7ZPy6//XVBBr8tyfZXx6TvvQkZm5yz18pUiXw8RZMJyBQHhqaiMsA4cm5hDhAypHyoctzJuStrQjw7/c8emoj0M4Z+9KAPipeMeLlhDGIO+hyhFz6Enrc+PWszHrYiw3UxNjMnK0oH2CMCt9/VJL8aUDGKKL/j5gbpfbBFhg90yeGX1kpXe8FefVIlh6PVHCTKwHcDXXLd2oIcPDqF6ugA9dx+Kf0j80hPkzx58Iwds0IpP+jfckuDLR/YNvL7rJ3/8csdlofdH3wxbfUB/OufnJXXHmuzY6xnS80v/0UZi8NABrO6TOl64dFWOR7rKdDBoV+OzSlbqjqcCjCz21rqTIq9lHJ5riWtN4BSt1mDjIFjSPlEwck/Zi3gvQ+tYdgS9xyCz03zZhkpP3H9m29qkI3X1wuHxJWeTTdU7xG2bm4UdLAMNh35viR77msWMhk8+oltd17DraUsbLaKlvjjBfBUqSzU0iWusahpgMWBSpp06u8LNv0/0D8WpVjuicok+SReNf1J8vAA0qXYXW8W5bTpMSzf+OVfcx8/FPBd/8F9FjajZ6mUCnB3Z73UmdI7WpxbcA3q7xaTll0ULCi4zIE/Ry8K6Z/UTbqM03O7WpehPXkq6ZWayiHaYDIL6/EW4SI4edbl3JW2+fLVJf3fZgGNFHbEpCJOcqUCmhDqGHW4cizrZyKDiCGjZK07SR/pFT6guv6BTDZtXhvhk2nICEQpz44A1d2vtM1uXXdNjWAEqXNcaRY41dxDgMt7MDWI2gOvluRqs2u6WAsb+IBCs8Nz1gSYgIpe9k7TVZox732GQY/A2wVNFnYYlm2+TpgmjHvoStjMuo68AGYjg/0dQodIDeJ1AAJc3oNrkR6dgfEr2YRul46d9SFew+hya3HA0MnhZQ3WYu9P7VhjywRlCdsqZejAd8Y+3Ky0zdgUJy+A3QQ2Qx1yxJcp1z06GXcYHOiMH3+7M+oy489sPv4lizkcJHQ4fZU8N8fZwBW7nHzlldQKwa/UxTqsB59xCF3YxDo8M8Yajnbf0yzMcTorZZi7oaMg1Gz0M44u+E4HV9ZhrNa0KIBrbUze9NOT0F3HP3yQqknZK9GT+PhLAfbx0gIyROg7T7fbjzykcKjPfLmrVclYwIyqbAW4qnvSB69k+k23zuM1yUeJyly9HqgewVev3WqZpwcUYE9H5VVMAc4rcp52K8CejsqrmAKcV+Q87VaAPR2VVzEFOK/IedqtAHs6Kq9iCnAScgHxFOCAwEzaigKc5JWAeApwQGAmbUUBTvJKQDwFOCAwk7byPwAAAP//Dbb7ZQAAAAZJREFUAwAjemUFNWPtVQAAAABJRU5ErkJggg==)


## View controls

Line numbers default on in Live Preview and Source. Toggle the floating Table of contents to jump between Markdown headings; HTML and fenced-code headings are excluded. The outline sits below Find when both are open. Scroll about 20 lines beyond the document end without changing the source.
