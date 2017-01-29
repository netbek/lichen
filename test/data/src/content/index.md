---
themes:
  - alpha
  - omega
title: Test page
---

# Test page

## URLs

* [Full URL](https://developer.mozilla.org/en-US/docs/Learn)
* [Implicit protocol](//developer.mozilla.org/en-US/docs/Learn)
* [Implicit domain name](/en-US/docs/Learn)
* [Sub-resources](Skills/Infrastructure/Understanding_URLs)
* [Going back in the directory tree](../CSS/display)
* [example.com](http://example.com)
* [www.example.com](http://www.example.com)
* [http://www.example.com](http://www.example.com)
* <me@example.com>

## Headings

### H3

#### H4

##### H5

###### H6

## Informational tags

### Note

```note
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
```

### Tip

```note class="note tip"
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
```

### Instruction

```note class="note instruction"
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
```

## Image

### Image without caption

![Alt text](The_Earth_seen_from_Apollo_17.jpg)

### Image with caption

![Alt text](The_Earth_seen_from_Apollo_17.jpg "Caption")

### External image without caption

![Alt text](http://lorempixel.com/400/300/abstract/)

### External image with caption

![Alt text](http://lorempixel.com/400/300/abstract/ "Caption")

## Responsive image

### Responsive image without caption

$[Alt text](The_Earth_seen_from_Apollo_17.jpg)

### Responsive image with caption

$[Alt text](The_Earth_seen_from_Apollo_17.jpg "Caption")

## Video

### Video without caption

%[Alt text](https://www.youtube.com/watch?v=0o4ONs2i1qw 320 240)

### Video with caption

%[Alt text](https://www.youtube.com/watch?v=0o4ONs2i1qw 320 240 "Caption")

## Templates

### Render tag

```template
{% render "list", site.data["near-earth-comets"].view.data %}{% endrender %}
```

## Render macro

```template
{{ render("button", {text: "Lorem ipsum dolor sit amet"}) }}
```

## Render macro inside HTML snippet

```template
<table>
  <tr>
    <td>{{ render("button", {text: "Lorem ipsum dolor sit amet"}) }}</td>
    <td>{{ render("button", {text: "Consectetur adipisicing elit"}) }}</td>
  </tr>
</table>
```

## LaTeX

```
\[\vec{v}_{\text{f}} =
\vec{v}_{\text{i}} + \vec{a}\Delta t\]
```

`\(\vec{v}_{\text{f}} = \vec{v}_{\text{i}} + \vec{a}\Delta t\)`

```
\[\begin{align} {\vec{v}_\text{f}}^{\;2} &= {\vec{v}_\text{i}}^{\; 2} +2\vec{a} \cdot \Delta \vec{x} \\ \text{or } {\vec{v}_\text{f}}^{\;2} &= {\vec{v}_\text{i}}^{\; 2} + 2\vec{a} \cdot \Delta \vec{y} \end{align}\]
```

```
\[\begin{align} \Delta \vec{x} &= \vec{v}_\text{i} \Delta t + \frac{1}{2} \vec{a} (\Delta t)^2 \\ \text{or } \Delta \vec{y} &= \vec{v}_\text{i} \Delta t + \frac{1}{2} \vec{a} (\Delta t)^2 \end{align}\]
```

```
\[\begin{align} \Delta \vec{x} &= \left(\frac{\vec{v}_\text{i}+\vec{v}_\text{f}}{2}\right)\Delta t \\ \text{or } \Delta \vec{y} &= \left(\frac{\vec{v}_\text{i}+\vec{v}_\text{f}}{2}\right)\Delta t \end{align}\]
```
