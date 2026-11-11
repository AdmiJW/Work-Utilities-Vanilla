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
