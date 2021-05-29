// @observablehq/plot v0.1.0 Copyright 2020-2021 Observable, Inc.
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? factory(exports, require('d3@6.7.0/dist/d3.min.js'))
    : typeof define === 'function' && define.amd
    ? define(['exports', 'd3@6.7.0/dist/d3.min.js'], factory)
    : ((global =
        typeof globalThis !== 'undefined' ? globalThis : global || self),
      factory((global.Plot = global.Plot || {}), global.d3));
})(this, function (exports, d3) {
  'use strict';

  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent =
      '.plot{display:block;font:10px system-ui,sans-serif;background:#fff;height:auto;height:intrinsic;max-width:100%}.plot text{white-space:pre}';
    document.head.appendChild(style);
  }

  var version = '0.1.0';

  function formatIsoDate(date) {
    if (!(date instanceof Date)) date = new Date(+date);
    if (isNaN(date)) return 'Invalid Date';
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();
    return `${formatIsoYear(
      date.getUTCFullYear(),
    )}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}${hours || minutes || seconds || milliseconds ? `T${pad(hours, 2)}:${pad(minutes, 2)}${seconds || milliseconds ? `:${pad(seconds, 2)}${milliseconds ? `.${pad(milliseconds, 3)}` : ``}` : ``}Z` : ``}`;
  }

  function formatIsoYear(year) {
    return year < 0
      ? `-${pad(-year, 6)}`
      : year > 9999
      ? `+${pad(year, 6)}`
      : pad(year, 4);
  }

  function pad(value, width) {
    return (value + '').padStart(width, '0');
  }

  function formatMonth(locale = 'en-US', month = 'short') {
    const format = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month });
    return (i) => {
      if (i != null && !isNaN((i = new Date(Date.UTC(2000, +i))))) {
        return format.format(i);
      }
    };
  }

  function formatWeekday(locale = 'en-US', weekday = 'short') {
    const format = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      weekday,
    });
    return (i) => {
      if (i != null && !isNaN((i = new Date(Date.UTC(2001, 0, +i))))) {
        return format.format(i);
      }
    };
  }

  function defined(x) {
    return x != null && !Number.isNaN(x);
  }

  function ascendingDefined(a, b) {
    return defined(b) - defined(a) || d3.ascending(a, b);
  }

  function nonempty(x) {
    return x != null && x + '' !== '';
  }

  function filter$1(index, ...channels) {
    for (const c of channels) {
      if (c) index = index.filter((i) => defined(c[i]));
    }
    return index;
  }

  function positive(x) {
    return x > 0 ? x : NaN;
  }

  function negative(x) {
    return x < 0 ? x : NaN;
  }

  function firstof(...values) {
    for (const v of values) {
      if (v !== undefined) {
        return v;
      }
    }
  }

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
  const TypedArray = Object.getPrototypeOf(Uint8Array);
  const objectToString = Object.prototype.toString;

  class Mark {
    constructor(data, channels = [], options = {}) {
      const names = new Set();
      this.data = data;
      const { transform } = maybeTransform(options);
      this.transform = transform;
      this.channels = channels.filter((channel) => {
        const { name, value, optional } = channel;
        if (value == null) {
          if (optional) return false;
          throw new Error(`missing channel value: ${name}`);
        }
        if (typeof value === 'string') {
          channel.value = field(value);
        }
        if (name !== undefined) {
          const key = name + '';
          if (key === '__proto__') throw new Error('illegal channel name');
          if (names.has(key)) throw new Error(`duplicate channel: ${key}`);
          names.add(key);
        }
        return true;
      });
    }
    initialize(facets) {
      let data = arrayify(this.data);
      let index = facets === undefined && data != null ? range(data) : facets;
      if (data !== undefined && this.transform !== undefined) {
        if (facets === undefined) index = index.length ? [index] : [];
        ({ facets: index, data } = this.transform(data, index));
        data = arrayify(data);
        if (facets === undefined && index.length) [index] = index;
      }
      return {
        index,
        channels: this.channels.map((channel) => {
          const { name } = channel;
          return [name == null ? undefined : name + '', Channel(data, channel)];
        }),
      };
    }
    plot({ marks = [], ...options } = {}) {
      return plot({ ...options, marks: [...marks, this] });
    }
  }

  // TODO Type coercion?
  function Channel(data, { scale, type, value }) {
    return {
      scale,
      type,
      value: valueof(data, value),
      label: value ? value.label : undefined,
    };
  }

  // This allows transforms to behave equivalently to channels.
  function valueof(data, value, type) {
    const array = type === undefined ? Array : type;
    return typeof value === 'string'
      ? array.from(data, field(value))
      : typeof value === 'function'
      ? array.from(data, value)
      : typeof value === 'number' || value instanceof Date
      ? array.from(data, constant(value))
      : value && typeof value.transform === 'function'
      ? arrayify(value.transform(data), type)
      : arrayify(value, type); // preserve undefined type
  }

  const field = (label) => Object.assign((d) => d[label], { label });
  const indexOf = (d, i) => i;
  const identity = { transform: (d) => d };
  const string = (x) => (x == null ? x : x + '');
  const number = (x) => (x == null ? x : +x);
  const boolean = (x) => (x == null ? x : !!x);
  const first$1 = (d) => d[0];
  const second = (d) => d[1];
  const constant = (x) => () => x;

  // A few extra color keywords not known to d3-color.
  const colors = new Set(['currentColor', 'none']);

  // Some channels may allow a string constant to be specified; to differentiate
  // string constants (e.g., "red") from named fields (e.g., "date"), this
  // function tests whether the given value is a CSS color string and returns a
  // tuple [channel, constant] where one of the two is undefined, and the other is
  // the given value. If you wish to reference a named field that is also a valid
  // CSS color, use an accessor (d => d.red) instead.
  function maybeColor(value, defaultValue) {
    if (value === undefined) value = defaultValue;
    return value === null
      ? [undefined, 'none']
      : typeof value === 'string' && (colors.has(value) || d3.color(value))
      ? [undefined, value]
      : [value, undefined];
  }

  // Similar to maybeColor, this tests whether the given value is a number
  // indicating a constant, and otherwise assumes that it’s a channel value.
  function maybeNumber(value, defaultValue) {
    if (value === undefined) value = defaultValue;
    return value === null || typeof value === 'number'
      ? [undefined, value]
      : [value, undefined];
  }

  // Validates the specified optional string against the allowed list of keywords.
  function maybeKeyword(input, name, allowed) {
    if (input != null) return keyword(input, name, allowed);
  }

  // Validates the specified required string against the allowed list of keywords.
  function keyword(input, name, allowed) {
    const i = (input + '').toLowerCase();
    if (!allowed.includes(i)) throw new Error(`invalid ${name}: ${input}`);
    return i;
  }

  // Promotes the specified data to an array or typed array as needed. If an array
  // type is provided (e.g., Array), then the returned array will strictly be of
  // the specified type; otherwise, any array or typed array may be returned. If
  // the specified data is null or undefined, returns the value as-is.
  function arrayify(data, type) {
    return data == null
      ? data
      : type === undefined
      ? data instanceof Array || data instanceof TypedArray
        ? data
        : Array.from(data)
      : data instanceof type
      ? data
      : type.from(data);
  }

  // For marks specified either as [0, x] or [x1, x2], such as areas and bars.
  function maybeZero(x, x1, x2, x3 = identity) {
    if (x1 === undefined && x2 === undefined) {
      // {x} or {}
      (x1 = 0), (x2 = x === undefined ? x3 : x);
    } else if (x1 === undefined) {
      // {x, x2} or {x2}
      x1 = x === undefined ? 0 : x;
    } else if (x2 === undefined) {
      // {x, x1} or {x1}
      x2 = x === undefined ? 0 : x;
    }
    return [x1, x2];
  }

  // For marks that have x and y channels (e.g., cell, dot, line, text).
  function maybeTuple(x, y) {
    return x === undefined && y === undefined ? [first$1, second] : [x, y];
  }

  // A helper for extracting the z channel, if it is variable. Used by transforms
  // that require series, such as moving average and normalize.
  function maybeZ({ z, fill, stroke } = {}) {
    if (z === undefined) [z] = maybeColor(fill);
    if (z === undefined) [z] = maybeColor(stroke);
    return z;
  }

  // Applies the specified titles via selection.call.
  function title(L) {
    return L
      ? (selection) =>
          selection
            .filter((i) => nonempty(L[i]))
            .append('title')
            .text((i) => L[i])
      : () => {};
  }

  // title for groups (lines, areas).
  function titleGroup(L) {
    return L
      ? (selection) =>
          selection
            .filter(([i]) => nonempty(L[i]))
            .append('title')
            .text(([i]) => L[i])
      : () => {};
  }

  // Returns a Uint32Array with elements [0, 1, 2, … data.length - 1].
  function range(data) {
    return Uint32Array.from(data, indexOf);
  }

  // Returns an array [values[index[0]], values[index[1]], …].
  function take(values, index) {
    return Array.from(index, (i) => values[i]);
  }

  function maybeInput(key, options) {
    if (options[key] !== undefined) return options[key];
    switch (key) {
      case 'x1':
      case 'x2':
        key = 'x';
        break;
      case 'y1':
      case 'y2':
        key = 'y';
        break;
    }
    return options[key];
  }

  // Defines a channel whose values are lazily populated by calling the returned
  // setter. If the given source is labeled, the label is propagated to the
  // returned channel definition.
  function lazyChannel(source) {
    let value;
    return [
      {
        transform: () => value,
        label: labelof(source),
      },
      (v) => (value = v),
    ];
  }

  function labelof(value, defaultValue) {
    return typeof value === 'string'
      ? value
      : value && value.label !== undefined
      ? value.label
      : defaultValue;
  }

  // Like lazyChannel, but allows the source to be null.
  function maybeLazyChannel(source) {
    return source == null ? [source] : lazyChannel(source);
  }

  // If both t1 and t2 are defined, returns a composite transform that first
  // applies t1 and then applies t2.
  function maybeTransform(
    { filter: f1, sort: s1, reverse: r1, transform: t1, ...options } = {},
    t2,
  ) {
    if (t1 === undefined) {
      if (f1 != null) t1 = filter(f1);
      if (s1 != null) t1 = compose(t1, sort(s1));
      if (r1) t1 = compose(t1, reverse);
    }
    return { ...options, transform: compose(t1, t2) };
  }

  // Assuming that both x1 and x2 and lazy channels (per above), this derives a
  // new a channel that’s the average of the two, and which inherits the channel
  // label (if any). Both input channels are assumed to be quantitative. If either
  // channel is temporal, the returned channel is also temporal.
  function mid(x1, x2) {
    return {
      transform(data) {
        const X1 = x1.transform(data);
        const X2 = x2.transform(data);
        return isTemporal(X1) || isTemporal(X2)
          ? Array.from(X1, (_, i) => new Date((+X1[i] + +X2[i]) / 2))
          : Float64Array.from(X1, (_, i) => (+X1[i] + +X2[i]) / 2);
      },
      label: x1.label,
    };
  }

  // This distinguishes between per-dimension options and a standalone value.
  function maybeValue(value) {
    return value === undefined ||
      (value &&
        value.toString === objectToString &&
        typeof value.transform !== 'function')
      ? value
      : { value };
  }

  function compose(t1, t2) {
    if (t1 == null) return t2 === null ? undefined : t2;
    if (t2 == null) return t1 === null ? undefined : t1;
    return (data, facets) => {
      ({ data, facets } = t1(data, facets));
      return t2(arrayify(data), facets);
    };
  }

  function sort(value) {
    return (
      typeof value === 'function' && value.length !== 1
        ? sortCompare
        : sortValue
    )(value);
  }

  function sortCompare(compare) {
    return (data, facets) => {
      const compareData = (i, j) => compare(data[i], data[j]);
      return { data, facets: facets.map((I) => I.slice().sort(compareData)) };
    };
  }

  function sortValue(value) {
    return (data, facets) => {
      const V = valueof(data, value);
      const compareValue = (i, j) => ascendingDefined(V[i], V[j]);
      return { data, facets: facets.map((I) => I.slice().sort(compareValue)) };
    };
  }

  function filter(value) {
    return (data, facets) => {
      const V = valueof(data, value);
      return { data, facets: facets.map((I) => I.filter((i) => V[i])) };
    };
  }

  function reverse(data, facets) {
    return { data, facets: facets.map((I) => I.slice().reverse()) };
  }

  function numberChannel(source) {
    return {
      transform: (data) => valueof(data, source, Float64Array),
      label: labelof(source),
    };
  }

  // TODO use Float64Array.from for position and radius scales?
  function values(channels = [], scales) {
    const values = Object.create(null);
    for (let [name, { value, scale }] of channels) {
      if (name !== undefined) {
        if (scale !== undefined) {
          scale = scales[scale];
          if (scale !== undefined) {
            value = Array.from(value, scale);
          }
        }
        values[name] = value;
      }
    }
    return values;
  }

  function isOrdinal(values) {
    for (const value of values) {
      if (value == null) continue;
      const type = typeof value;
      return type === 'string' || type === 'boolean';
    }
  }

  function isTemporal(values) {
    for (const value of values) {
      if (value == null) continue;
      return value instanceof Date;
    }
  }

  class AxisX {
    constructor({
      name = 'x',
      axis,
      ticks,
      tickSize = name === 'fx' ? 0 : 6,
      tickPadding = tickSize === 0 ? 9 : 3,
      tickFormat,
      grid,
      label,
      labelAnchor,
      labelOffset,
      tickRotate,
    } = {}) {
      this.name = name;
      this.axis = keyword(axis, 'axis', ['top', 'bottom']);
      this.ticks = ticks;
      this.tickSize = number(tickSize);
      this.tickPadding = number(tickPadding);
      this.tickFormat = tickFormat;
      this.grid = boolean(grid);
      this.label = string(label);
      this.labelAnchor = maybeKeyword(labelAnchor, 'labelAnchor', [
        'center',
        'left',
        'right',
      ]);
      this.labelOffset = number(labelOffset);
      this.tickRotate = number(tickRotate);
    }
    render(
      index,
      { [this.name]: x, fy },
      channels,
      {
        width,
        height,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        facetMarginTop,
        facetMarginBottom,
        labelMarginLeft = 0,
        labelMarginRight = 0,
      },
    ) {
      const { axis, grid, label, labelAnchor, labelOffset, tickRotate } = this;
      const offset =
        this.name === 'x'
          ? 0
          : axis === 'top'
          ? marginTop - facetMarginTop
          : marginBottom - facetMarginBottom;
      const offsetSign = axis === 'top' ? -1 : 1;
      const ty =
        offsetSign * offset +
        (axis === 'top' ? marginTop : height - marginBottom);
      return d3
        .create('svg:g')
        .attr('transform', `translate(0,${ty})`)
        .call(createAxis(axis === 'top' ? d3.axisTop : d3.axisBottom, x, this))
        .call(maybeTickRotate, tickRotate)
        .attr('font-size', null)
        .attr('font-family', null)
        .call((g) => g.select('.domain').remove())
        .call(
          !grid
            ? () => {}
            : fy
            ? gridFacetX(fy, -ty)
            : gridX(offsetSign * (marginBottom + marginTop - height)),
        )
        .call(
          !label
            ? () => {}
            : (g) =>
                g
                  .append('text')
                  .attr('fill', 'currentColor')
                  .attr(
                    'transform',
                    `translate(${
                      labelAnchor === 'center'
                        ? (width + marginLeft - marginRight) / 2
                        : labelAnchor === 'right'
                        ? width + labelMarginRight
                        : -labelMarginLeft
                    },${labelOffset * offsetSign})`,
                  )
                  .attr('dy', axis === 'top' ? '1em' : '-0.32em')
                  .attr(
                    'text-anchor',
                    labelAnchor === 'center'
                      ? 'middle'
                      : labelAnchor === 'right'
                      ? 'end'
                      : 'start',
                  )
                  .text(label),
        )
        .node();
    }
  }

  class AxisY {
    constructor({
      name = 'y',
      axis,
      ticks,
      tickSize = name === 'fy' ? 0 : 6,
      tickPadding = tickSize === 0 ? 9 : 3,
      tickFormat,
      grid,
      label,
      labelAnchor,
      labelOffset,
      tickRotate,
    } = {}) {
      this.name = name;
      this.axis = keyword(axis, 'axis', ['left', 'right']);
      this.ticks = ticks;
      this.tickSize = number(tickSize);
      this.tickPadding = number(tickPadding);
      this.tickFormat = tickFormat;
      this.grid = boolean(grid);
      this.label = string(label);
      this.labelAnchor = maybeKeyword(labelAnchor, 'labelAnchor', [
        'center',
        'top',
        'bottom',
      ]);
      this.labelOffset = number(labelOffset);
      this.tickRotate = number(tickRotate);
    }
    render(
      index,
      { [this.name]: y, fx },
      channels,
      {
        width,
        height,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        facetMarginLeft,
        facetMarginRight,
      },
    ) {
      const { axis, grid, label, labelAnchor, labelOffset, tickRotate } = this;
      const offset =
        this.name === 'y'
          ? 0
          : axis === 'left'
          ? marginLeft - facetMarginLeft
          : marginRight - facetMarginRight;
      const offsetSign = axis === 'left' ? -1 : 1;
      const tx =
        offsetSign * offset +
        (axis === 'right' ? width - marginRight : marginLeft);
      return d3
        .create('svg:g')
        .attr('transform', `translate(${tx},0)`)
        .call(
          createAxis(axis === 'right' ? d3.axisRight : d3.axisLeft, y, this),
        )
        .call(maybeTickRotate, tickRotate)
        .attr('font-size', null)
        .attr('font-family', null)
        .call((g) => g.select('.domain').remove())
        .call(
          !grid
            ? () => {}
            : fx
            ? gridFacetY(fx, -tx)
            : gridY(offsetSign * (marginLeft + marginRight - width)),
        )
        .call(
          !label
            ? () => {}
            : (g) =>
                g
                  .append('text')
                  .attr('fill', 'currentColor')
                  .attr(
                    'transform',
                    `translate(${labelOffset * offsetSign},${
                      labelAnchor === 'center'
                        ? (height + marginTop - marginBottom) / 2
                        : labelAnchor === 'bottom'
                        ? height - marginBottom
                        : marginTop
                    })${labelAnchor === 'center' ? ` rotate(-90)` : ''}`,
                  )
                  .attr(
                    'dy',
                    labelAnchor === 'center'
                      ? axis === 'right'
                        ? '-0.32em'
                        : '0.75em'
                      : labelAnchor === 'bottom'
                      ? '1.4em'
                      : '-1em',
                  )
                  .attr(
                    'text-anchor',
                    labelAnchor === 'center'
                      ? 'middle'
                      : axis === 'right'
                      ? 'end'
                      : 'start',
                  )
                  .text(label),
        )
        .node();
    }
  }

  function gridX(y2) {
    return (g) =>
      g
        .selectAll('.tick line')
        .clone(true)
        .attr('stroke-opacity', 0.1)
        .attr('y2', y2);
  }

  function gridY(x2) {
    return (g) =>
      g
        .selectAll('.tick line')
        .clone(true)
        .attr('stroke-opacity', 0.1)
        .attr('x2', x2);
  }

  function gridFacetX(fy, ty) {
    const dy = fy.bandwidth();
    return (g) =>
      g
        .selectAll('.tick')
        .append('path')
        .attr('stroke', 'currentColor')
        .attr('stroke-opacity', 0.1)
        .attr(
          'd',
          fy
            .domain()
            .map((v) => `M0,${fy(v) + ty}v${dy}`)
            .join(''),
        );
  }

  function gridFacetY(fx, tx) {
    const dx = fx.bandwidth();
    return (g) =>
      g
        .selectAll('.tick')
        .append('path')
        .attr('stroke', 'currentColor')
        .attr('stroke-opacity', 0.1)
        .attr(
          'd',
          fx
            .domain()
            .map((v) => `M${fx(v) + tx},0h${dx}`)
            .join(''),
        );
  }

  function createAxis(
    axis,
    scale,
    { ticks, tickSize, tickPadding, tickFormat },
  ) {
    if (!scale.tickFormat && typeof tickFormat !== 'function') {
      // D3 doesn’t provide a tick format for ordinal scales; we want shorthand
      // when an ordinal domain is numbers or dates, and we want null to mean the
      // empty string, not the default identity format.
      tickFormat =
        tickFormat === undefined
          ? isTemporal(scale.domain())
            ? formatIsoDate
            : string
          : (typeof tickFormat === 'string'
              ? isTemporal(scale.domain())
                ? d3.utcFormat
                : d3.format
              : constant)(tickFormat);
    }
    return axis(scale)
      .ticks(
        Array.isArray(ticks) ? null : ticks,
        typeof tickFormat === 'function' ? null : tickFormat,
      )
      .tickFormat(typeof tickFormat === 'function' ? tickFormat : null)
      .tickSizeInner(tickSize)
      .tickSizeOuter(0)
      .tickPadding(tickPadding)
      .tickValues(Array.isArray(ticks) ? ticks : null);
  }

  function maybeTickRotate(g, rotate) {
    if (!(rotate = +rotate)) return;
    const radians = Math.PI / 180;
    const labels = g.selectAll('text').attr('dy', '0.32em');
    const y = +labels.attr('y');
    if (y) {
      const s = Math.sign(y);
      labels
        .attr('y', null)
        .attr(
          'transform',
          `translate(0, ${
            y + s * 4 * Math.cos(rotate * radians)
          }) rotate(${rotate})`,
        )
        .attr(
          'text-anchor',
          Math.abs(rotate) < 10
            ? 'middle'
            : (rotate < 0) ^ (s > 0)
            ? 'start'
            : 'end',
        );
    } else {
      const x = +labels.attr('x');
      const s = Math.sign(x);
      labels
        .attr('x', null)
        .attr(
          'transform',
          `translate(${
            x + s * 4 * Math.abs(Math.sin(rotate * radians))
          }, 0) rotate(${rotate})`,
        )
        .attr(
          'text-anchor',
          Math.abs(rotate) > 60 ? 'middle' : s > 0 ? 'start' : 'end',
        );
    }
  }

  function Axes(
    { x: xScale, y: yScale, fx: fxScale, fy: fyScale },
    {
      x = {},
      y = {},
      fx = {},
      fy = {},
      grid,
      facet: { grid: facetGrid } = {},
    } = {},
  ) {
    let { axis: xAxis = true } = x;
    let { axis: yAxis = true } = y;
    let { axis: fxAxis = true } = fx;
    let { axis: fyAxis = true } = fy;
    if (!xScale) xAxis = null;
    else if (xAxis === true) xAxis = 'bottom';
    if (!yScale) yAxis = null;
    else if (yAxis === true) yAxis = 'left';
    if (!fxScale) fxAxis = null;
    else if (fxAxis === true) fxAxis = xAxis === 'bottom' ? 'top' : 'bottom';
    if (!fyScale) fyAxis = null;
    else if (fyAxis === true) fyAxis = yAxis === 'left' ? 'right' : 'left';
    return {
      ...(xAxis && { x: new AxisX({ grid, ...x, axis: xAxis }) }),
      ...(yAxis && { y: new AxisY({ grid, ...y, axis: yAxis }) }),
      ...(fxAxis && {
        fx: new AxisX({ name: 'fx', grid: facetGrid, ...fx, axis: fxAxis }),
      }),
      ...(fyAxis && {
        fy: new AxisY({ name: 'fy', grid: facetGrid, ...fy, axis: fyAxis }),
      }),
    };
  }

  // Mutates axis.ticks!
  // TODO Populate tickFormat if undefined, too?
  function autoAxisTicks(
    { x, y, fx, fy },
    { x: xAxis, y: yAxis, fx: fxAxis, fy: fyAxis },
  ) {
    if (fxAxis) autoAxisTicksK(fx, fxAxis, 80);
    if (fyAxis) autoAxisTicksK(fy, fyAxis, 35);
    if (xAxis) autoAxisTicksK(x, xAxis, 80);
    if (yAxis) autoAxisTicksK(y, yAxis, 35);
  }

  function autoAxisTicksK(scale, axis, k) {
    if (axis.ticks === undefined) {
      const [min, max] = scale.scale.range();
      axis.ticks = Math.abs(max - min) / k;
    }
  }

  // Mutates axis.{label,labelAnchor,labelOffset}!
  function autoAxisLabels(channels, scales, { x, y, fx, fy }, dimensions) {
    if (fx) {
      autoAxisLabelsX(fx, scales.fx, channels.get('fx'));
      if (fx.labelOffset === undefined) {
        const { facetMarginTop, facetMarginBottom } = dimensions;
        fx.labelOffset = fx.axis === 'top' ? facetMarginTop : facetMarginBottom;
      }
    }
    if (fy) {
      autoAxisLabelsY(fy, fx, scales.fy, channels.get('fy'));
      if (fy.labelOffset === undefined) {
        const { facetMarginLeft, facetMarginRight } = dimensions;
        fy.labelOffset =
          fy.axis === 'left' ? facetMarginLeft : facetMarginRight;
      }
    }
    if (x) {
      autoAxisLabelsX(x, scales.x, channels.get('x'));
      if (x.labelOffset === undefined) {
        const { marginTop, marginBottom, facetMarginTop, facetMarginBottom } =
          dimensions;
        x.labelOffset =
          x.axis === 'top'
            ? marginTop - facetMarginTop
            : marginBottom - facetMarginBottom;
      }
    }
    if (y) {
      autoAxisLabelsY(y, x, scales.y, channels.get('y'));
      if (y.labelOffset === undefined) {
        const { marginRight, marginLeft, facetMarginLeft, facetMarginRight } =
          dimensions;
        y.labelOffset =
          y.axis === 'left'
            ? marginLeft - facetMarginLeft
            : marginRight - facetMarginRight;
      }
    }
  }

  function autoAxisLabelsX(axis, scale, channels) {
    if (axis.labelAnchor === undefined) {
      axis.labelAnchor =
        scale.type === 'ordinal' ? 'center' : scale.reverse ? 'left' : 'right';
    }
    if (axis.label === undefined) {
      axis.label = inferLabel(channels, scale, axis, 'x');
    }
  }

  function autoAxisLabelsY(axis, opposite, scale, channels) {
    if (axis.labelAnchor === undefined) {
      axis.labelAnchor =
        scale.type === 'ordinal'
          ? 'center'
          : opposite && opposite.axis === 'top'
          ? 'bottom' // TODO scale.reverse?
          : 'top';
    }
    if (axis.label === undefined) {
      axis.label = inferLabel(channels, scale, axis, 'y');
    }
  }

  // Channels can have labels; if all the channels for a given scale are
  // consistently labeled (i.e., have the same value if not undefined), and the
  // corresponding axis doesn’t already have an explicit label, then the channels’
  // label is promoted to the corresponding axis.
  function inferLabel(channels = [], scale, axis, key) {
    let candidate;
    for (const { label } of channels) {
      if (label === undefined) continue;
      if (candidate === undefined) candidate = label;
      else if (candidate !== label) return;
    }
    if (candidate !== undefined) {
      const { percent, reverse } = scale;
      // Ignore the implicit label for temporal scales if it’s simply “date”.
      if (scale.type === 'temporal' && /^(date|time|year)$/i.test(candidate))
        return;
      if (scale.type !== 'ordinal' && (key === 'x' || key === 'y')) {
        if (percent) candidate = `${candidate} (%)`;
        if (axis.labelAnchor === 'center') {
          candidate = `${candidate} →`;
        } else if (key === 'x') {
          candidate = reverse ? `← ${candidate}` : `${candidate} →`;
        } else {
          candidate = `${reverse ? '↓ ' : '↑ '}${candidate}`;
        }
      }
    }
    return candidate;
  }

  function facets(data, { x, y, ...options }, marks) {
    return x === undefined && y === undefined
      ? marks // if no facets are specified, ignore!
      : [new Facet(data, { x, y, ...options }, marks)];
  }

  class Facet extends Mark {
    constructor(data, { x, y, ...options } = {}, marks = []) {
      super(
        data,
        [
          { name: 'fx', value: x, scale: 'fx', optional: true },
          { name: 'fy', value: y, scale: 'fy', optional: true },
        ],
        options,
      );
      this.marks = marks.flat(Infinity);
      // The following fields are set by initialize:
      this.marksChannels = undefined; // array of mark channels
      this.marksIndex = undefined; // array of mark indexes (for non-faceted marks)
      this.marksIndexByFacet = undefined; // map from facet key to array of mark indexes
    }
    initialize() {
      const { index, channels } = super.initialize();
      const facets = index === undefined ? [] : facetGroups(index, channels);
      const facetsKeys = Array.from(facets, first$1);
      const facetsIndex = Array.from(facets, second);
      const subchannels = [];
      const marksChannels = (this.marksChannels = []);
      const marksIndex = (this.marksIndex = new Array(this.marks.length));
      const marksIndexByFacet = (this.marksIndexByFacet = facetMap(channels));
      for (const facetKey of facetsKeys) {
        marksIndexByFacet.set(facetKey, new Array(this.marks.length));
      }
      for (let i = 0; i < this.marks.length; ++i) {
        const mark = this.marks[i];
        const markFacets = mark.data === this.data ? facetsIndex : undefined;
        const { index, channels } = mark.initialize(markFacets);
        // If an index is returned by mark.initialize, its structure depends on
        // whether or not faceting has been applied: it is a flat index ([0, 1, 2,
        // …]) when not faceted, and a nested index ([[0, 1, …], [2, 3, …], …])
        // when faceted. Faceting is only applied if the mark data is the same as
        // the facet’s data.
        if (index !== undefined) {
          if (markFacets) {
            for (let j = 0; j < facetsKeys.length; ++j) {
              marksIndexByFacet.get(facetsKeys[j])[i] = index[j];
            }
            marksIndex[i] = []; // implicit empty index for sparse facets
          } else {
            for (let j = 0; j < facetsKeys.length; ++j) {
              marksIndexByFacet.get(facetsKeys[j])[i] = index;
            }
            marksIndex[i] = index;
          }
        }
        for (const [, channel] of channels) {
          subchannels.push([, channel]);
        }
        marksChannels.push(channels);
      }
      return { index, channels: [...channels, ...subchannels] };
    }
    render(index, scales, channels, dimensions, axes) {
      const { marks, marksChannels, marksIndex, marksIndexByFacet } = this;
      const { fx, fy } = scales;
      const fyMargins = fy && {
        marginTop: 0,
        marginBottom: 0,
        height: fy.bandwidth(),
      };
      const fxMargins = fx && {
        marginRight: 0,
        marginLeft: 0,
        width: fx.bandwidth(),
      };
      const subdimensions = { ...dimensions, ...fxMargins, ...fyMargins };
      const marksValues = marksChannels.map((channels) =>
        values(channels, scales),
      );
      return d3
        .create('svg:g')
        .call((g) => {
          if (fy && axes.y) {
            const domain = fy.domain();
            const axis1 = axes.y,
              axis2 = nolabel(axis1);
            const j =
              axis1.labelAnchor === 'bottom'
                ? domain.length - 1
                : axis1.labelAnchor === 'center'
                ? domain.length >> 1
                : 0;
            const fyDimensions = { ...dimensions, ...fyMargins };
            g.selectAll()
              .data(domain)
              .join('g')
              .attr('transform', (ky) => `translate(0,${fy(ky)})`)
              .append((_, i) =>
                (i === j ? axis1 : axis2).render(
                  null,
                  scales,
                  null,
                  fyDimensions,
                ),
              );
          }
          if (fx && axes.x) {
            const domain = fx.domain();
            const axis1 = axes.x,
              axis2 = nolabel(axis1);
            const j =
              axis1.labelAnchor === 'right'
                ? domain.length - 1
                : axis1.labelAnchor === 'center'
                ? domain.length >> 1
                : 0;
            const { marginLeft, marginRight } = dimensions;
            const fxDimensions = {
              ...dimensions,
              ...fxMargins,
              labelMarginLeft: marginLeft,
              labelMarginRight: marginRight,
            };
            g.selectAll()
              .data(domain)
              .join('g')
              .attr('transform', (kx) => `translate(${fx(kx)},0)`)
              .append((_, i) =>
                (i === j ? axis1 : axis2).render(
                  null,
                  scales,
                  null,
                  fxDimensions,
                ),
              );
          }
        })
        .call((g) =>
          g
            .selectAll()
            .data(facetKeys(scales))
            .join('g')
            .attr('transform', facetTranslate(fx, fy))
            .each(function (key) {
              const marksFacetIndex = marksIndexByFacet.get(key) || marksIndex;
              for (let i = 0; i < marks.length; ++i) {
                const node = marks[i].render(
                  marksFacetIndex[i],
                  scales,
                  marksValues[i],
                  subdimensions,
                );
                if (node != null) this.appendChild(node);
              }
            }),
        )
        .node();
    }
  }

  // Derives a copy of the specified axis with the label disabled.
  function nolabel(axis) {
    return axis === undefined || axis.label === undefined
      ? axis // use the existing axis if unlabeled
      : Object.assign(Object.create(axis), { label: undefined });
  }

  // Unlike facetGroups, which returns groups in order of input data, this returns
  // keys in order of the associated scale’s domains.
  function facetKeys({ fx, fy }) {
    return fx && fy
      ? d3.cross(fx.domain(), fy.domain())
      : fx
      ? fx.domain()
      : fy.domain();
  }

  // Returns an array of [[key1, index1], [key2, index2], …] representing the data
  // indexes associated with each facet. For two-dimensional faceting, each key
  // is a two-element array; see also facetMap.
  function facetGroups(index, channels) {
    return (
      channels.length > 1 ? facetGroup2 : facetGroup1
    )(index, ...channels);
  }

  function facetGroup1(index, [, { value: F }]) {
    return d3.groups(index, (i) => F[i]);
  }

  function facetGroup2(index, [, { value: FX }], [, { value: FY }]) {
    return d3
      .groups(
        index,
        (i) => FX[i],
        (i) => FY[i],
      )
      .flatMap(([x, xgroup]) => xgroup.map(([y, ygroup]) => [[x, y], ygroup]));
  }

  // This must match the key structure returned by facetGroups.
  function facetTranslate(fx, fy) {
    return fx && fy
      ? ([kx, ky]) => `translate(${fx(kx)},${fy(ky)})`
      : fx
      ? (kx) => `translate(${fx(kx)},0)`
      : (ky) => `translate(0,${fy(ky)})`;
  }

  function facetMap(channels) {
    return new (channels.length > 1 ? FacetMap2 : FacetMap)();
  }

  class FacetMap {
    constructor() {
      this._ = new d3.InternMap();
    }
    has(key) {
      return this._.has(key);
    }
    get(key) {
      return this._.get(key);
    }
    set(key, value) {
      return this._.set(key, value), this;
    }
  }

  // A Map-like interface that supports paired keys.
  class FacetMap2 extends FacetMap {
    has([key1, key2]) {
      const map = super.get(key1);
      return map ? map.has(key2) : false;
    }
    get([key1, key2]) {
      const map = super.get(key1);
      return map && map.get(key2);
    }
    set([key1, key2], value) {
      const map = super.get(key1);
      if (map) map.set(key2, value);
      else super.set(key1, new d3.InternMap([[key2, value]]));
      return this;
    }
  }

  // Positional scales have associated axes, and for ordinal data, a point or band
  // scale is used instead of an ordinal scale.
  const position = Symbol('position');

  // Color scales default to the turbo interpolator for quantitative data, and to
  // the Tableau10 scheme for ordinal data. In the future, color scales may also
  // have an associated legend.
  const color = Symbol('color');

  // Radius scales default to the sqrt type, have a default range of [0, 3], and a
  // default domain from 0 to the median first quartile of associated channels.
  const radius = Symbol('radius');

  // Opacity scales have a default range of [0, 1], and a default domain from 0 to
  // the maximum value of associated channels.
  const opacity = Symbol('opacity');

  // TODO Rather than hard-coding the list of known scale names, collect the names
  // and categories for each plot specification, so that custom marks can register
  // custom scales.
  const registry = new Map([
    ['x', position],
    ['y', position],
    ['fx', position],
    ['fy', position],
    ['r', radius],
    ['color', color],
    ['opacity', opacity],
  ]);

  const flip = (i) => (t) => i(1 - t);

  // TODO Allow this to be extended.
  const interpolators = new Map([
    // numbers
    ['number', d3.interpolateNumber],

    // color spaces
    ['rgb', d3.interpolateRgb],
    ['hsl', d3.interpolateHsl],
    ['hcl', d3.interpolateHcl],
    ['lab', d3.interpolateLab],
  ]);

  // TODO Allow this to be extended.
  const schemes$1 = new Map([
    // diverging
    ['brbg', d3.interpolateBrBG],
    ['prgn', d3.interpolatePRGn],
    ['piyg', d3.interpolatePiYG],
    ['puor', d3.interpolatePuOr],
    ['rdbu', d3.interpolateRdBu],
    ['rdgy', d3.interpolateRdGy],
    ['rdylbu', d3.interpolateRdYlBu],
    ['rdylgn', d3.interpolateRdYlGn],
    ['spectral', d3.interpolateSpectral],

    // reversed diverging (for temperature data)
    ['burd', (t) => d3.interpolateRdBu(1 - t)],
    ['buylrd', (t) => d3.interpolateRdYlBu(1 - t)],

    // sequential (single-hue)
    ['blues', d3.interpolateBlues],
    ['greens', d3.interpolateGreens],
    ['greys', d3.interpolateGreys],
    ['purples', d3.interpolatePurples],
    ['reds', d3.interpolateReds],
    ['oranges', d3.interpolateOranges],

    // sequential (multi-hue)
    ['turbo', d3.interpolateTurbo],
    ['viridis', d3.interpolateViridis],
    ['magma', d3.interpolateMagma],
    ['inferno', d3.interpolateInferno],
    ['plasma', d3.interpolatePlasma],
    ['cividis', d3.interpolateCividis],
    ['cubehelix', d3.interpolateCubehelixDefault],
    ['warm', d3.interpolateWarm],
    ['cool', d3.interpolateCool],
    ['bugn', d3.interpolateBuGn],
    ['bupu', d3.interpolateBuPu],
    ['gnbu', d3.interpolateGnBu],
    ['orrd', d3.interpolateOrRd],
    ['pubugn', d3.interpolatePuBuGn],
    ['pubu', d3.interpolatePuBu],
    ['purd', d3.interpolatePuRd],
    ['rdpu', d3.interpolateRdPu],
    ['ylgnbu', d3.interpolateYlGnBu],
    ['ylgn', d3.interpolateYlGn],
    ['ylorbr', d3.interpolateYlOrBr],
    ['ylorrd', d3.interpolateYlOrRd],

    // cyclical
    ['rainbow', d3.interpolateRainbow],
    ['sinebow', d3.interpolateSinebow],
  ]);

  function Interpolator(interpolate) {
    const i = (interpolate + '').toLowerCase();
    if (!interpolators.has(i)) throw new Error(`unknown interpolator: ${i}`);
    return interpolators.get(i);
  }

  function Scheme$1(scheme) {
    const s = (scheme + '').toLowerCase();
    if (!schemes$1.has(s)) throw new Error(`unknown scheme: ${s}`);
    return schemes$1.get(s);
  }

  function ScaleQ(
    key,
    scale,
    channels,
    {
      nice,
      clamp,
      zero,
      domain = (registry.get(key) === radius || registry.get(key) === opacity
        ? inferZeroDomain
        : inferDomain$1)(channels),
      percent,
      round,
      range = registry.get(key) === radius
        ? inferRadialRange(channels, domain)
        : registry.get(key) === opacity
        ? [0, 1]
        : undefined,
      scheme,
      type,
      interpolate = registry.get(key) === color
        ? range !== undefined
          ? d3.interpolateRgb
          : scheme !== undefined
          ? Scheme$1(scheme)
          : type === 'cyclical'
          ? d3.interpolateRainbow
          : d3.interpolateTurbo
        : round
        ? d3.interpolateRound
        : undefined,
      reverse,
      inset,
    },
  ) {
    if (zero)
      domain =
        domain[1] < 0
          ? [domain[0], 0]
          : domain[0] > 0
          ? [0, domain[1]]
          : domain;
    if ((reverse = !!reverse)) domain = d3.reverse(domain);
    scale.domain(domain);
    if (nice) scale.nice(nice === true ? undefined : nice);

    // Sometimes interpolator is named interpolator, such as "lab" for Lab color
    // space. Other times interpolate is a function that takes two arguments and
    // is used in conjunction with the range. And other times the interpolate
    // function is a “fixed” interpolator independent of the range, as when a
    // color scheme such as interpolateRdBu is used.
    if (interpolate !== undefined) {
      if (typeof interpolate !== 'function') {
        interpolate = Interpolator(interpolate);
      } else if (interpolate.length === 1) {
        if (reverse) interpolate = flip(interpolate);
        interpolate = constant(interpolate);
      }
      scale.interpolate(interpolate);
    }

    if (range !== undefined) scale.range(range);
    if (clamp) scale.clamp(clamp);
    return {
      type: 'quantitative',
      reverse,
      domain,
      range,
      scale,
      inset,
      percent,
    };
  }

  function ScaleLinear(key, channels, options) {
    return ScaleQ(key, d3.scaleLinear(), channels, options);
  }

  function ScalePow(key, channels, { exponent = 1, ...options }) {
    return ScaleQ(key, d3.scalePow().exponent(exponent), channels, options);
  }

  function ScaleLog(
    key,
    channels,
    { base = 10, domain = inferLogDomain(channels), ...options },
  ) {
    return ScaleQ(key, d3.scaleLog().base(base), channels, {
      domain,
      ...options,
    });
  }

  function ScaleSymlog(key, channels, { constant = 1, ...options }) {
    return ScaleQ(key, d3.scaleSymlog().constant(constant), channels, options);
  }

  function ScaleIdentity() {
    return { type: 'identity', scale: d3.scaleIdentity() };
  }

  function ScaleDiverging(
    key,
    channels,
    {
      nice,
      clamp,
      domain = inferDomain$1(channels),
      pivot = 0,
      range,
      scheme,
      interpolate = registry.get(key) === color
        ? range !== undefined
          ? d3.interpolateRgb
          : scheme !== undefined
          ? Scheme$1(scheme)
          : d3.interpolateRdBu
        : undefined,
      reverse,
    },
  ) {
    domain = [Math.min(domain[0], pivot), pivot, Math.max(domain[1], pivot)];
    if ((reverse = !!reverse)) domain = d3.reverse(domain);

    // Sometimes interpolator is named interpolator, such as "lab" for Lab color
    // space; other times it is a function that takes t in [0, 1].
    if (interpolate !== undefined && typeof interpolate !== 'function') {
      interpolate = Interpolator(interpolate);
    }

    // If an explicit range is specified, promote it to a piecewise interpolator.
    if (range !== undefined) interpolate = d3.piecewise(interpolate, range);

    const scale = d3.scaleDiverging(domain, interpolate);
    if (clamp) scale.clamp(clamp);
    if (nice) scale.nice(nice);
    return { type: 'quantitative', reverse, domain, scale };
  }

  function inferDomain$1(channels, f) {
    return [
      d3.min(channels, ({ value }) =>
        value === undefined ? value : d3.min(value, f),
      ),
      d3.max(channels, ({ value }) =>
        value === undefined ? value : d3.max(value, f),
      ),
    ];
  }

  function inferZeroDomain(channels) {
    return [
      0,
      d3.max(channels, ({ value }) =>
        value === undefined ? value : d3.max(value),
      ),
    ];
  }

  // We don’t want the upper bound of the radial domain to be zero, as this would
  // be degenerate, so we ignore nonpositive values.
  function inferRadialRange(channels, domain) {
    const h25 = d3.quantile(channels, 0.5, ({ value }) =>
      value === undefined ? NaN : d3.quantile(value, 0.25, positive),
    );
    return domain.map((d) => 3 * Math.sqrt(d / h25));
  }

  function inferLogDomain(channels) {
    for (const { value } of channels) {
      if (value !== undefined) {
        for (let v of value) {
          v = +v;
          if (v > 0) return inferDomain$1(channels, positive);
          if (v < 0) return inferDomain$1(channels, negative);
        }
      }
    }
    return [1, 10];
  }

  function ScaleT(key, scale, channels, options) {
    const s = ScaleQ(key, scale, channels, options);
    s.type = 'temporal';
    return s;
  }

  function ScaleTime(key, channels, options) {
    return ScaleT(key, d3.scaleTime(), channels, options);
  }

  function ScaleUtc(key, channels, options) {
    return ScaleT(key, d3.scaleUtc(), channels, options);
  }

  // TODO Allow this to be extended.
  const schemes = new Map([
    // categorical
    ['accent', d3.schemeAccent],
    ['category10', d3.schemeCategory10],
    ['dark2', d3.schemeDark2],
    ['paired', d3.schemePaired],
    ['pastel1', d3.schemePastel1],
    ['pastel2', d3.schemePastel2],
    ['set1', d3.schemeSet1],
    ['set2', d3.schemeSet2],
    ['set3', d3.schemeSet3],
    ['tableau10', d3.schemeTableau10],

    // diverging
    ['brbg', scheme11(d3.schemeBrBG, d3.interpolateBrBG)],
    ['prgn', scheme11(d3.schemePRGn, d3.interpolatePRGn)],
    ['piyg', scheme11(d3.schemePiYG, d3.interpolatePiYG)],
    ['puor', scheme11(d3.schemePuOr, d3.interpolatePuOr)],
    ['rdbu', scheme11(d3.schemeRdBu, d3.interpolateRdBu)],
    ['rdgy', scheme11(d3.schemeRdGy, d3.interpolateRdGy)],
    ['rdylbu', scheme11(d3.schemeRdYlBu, d3.interpolateRdYlBu)],
    ['rdylgn', scheme11(d3.schemeRdYlGn, d3.interpolateRdYlGn)],
    ['spectral', scheme11(d3.schemeSpectral, d3.interpolateSpectral)],

    // reversed diverging (for temperature data)
    ['burd', scheme11r(d3.schemeRdBu, d3.interpolateRdBu)],
    ['buylrd', scheme11r(d3.schemeRdGy, d3.interpolateRdGy)],

    // sequential (single-hue)
    ['blues', scheme9(d3.schemeBlues, d3.interpolateBlues)],
    ['greens', scheme9(d3.schemeGreens, d3.interpolateGreens)],
    ['greys', scheme9(d3.schemeGreys, d3.interpolateGreys)],
    ['oranges', scheme9(d3.schemeOranges, d3.interpolateOranges)],
    ['purples', scheme9(d3.schemePurples, d3.interpolatePurples)],
    ['reds', scheme9(d3.schemeReds, d3.interpolateReds)],

    // sequential (multi-hue)
    ['turbo', schemei(d3.interpolateTurbo)],
    ['viridis', schemei(d3.interpolateViridis)],
    ['magma', schemei(d3.interpolateMagma)],
    ['inferno', schemei(d3.interpolateInferno)],
    ['plasma', schemei(d3.interpolatePlasma)],
    ['cividis', schemei(d3.interpolateCividis)],
    ['cubehelix', schemei(d3.interpolateCubehelixDefault)],
    ['warm', schemei(d3.interpolateWarm)],
    ['cool', schemei(d3.interpolateCool)],
    ['bugn', scheme9(d3.schemeBuGn, d3.interpolateBuGn)],
    ['bupu', scheme9(d3.schemeBuPu, d3.interpolateBuPu)],
    ['gnbu', scheme9(d3.schemeGnBu, d3.interpolateGnBu)],
    ['orrd', scheme9(d3.schemeOrRd, d3.interpolateOrRd)],
    ['pubu', scheme9(d3.schemePuBu, d3.interpolatePuBu)],
    ['pubugn', scheme9(d3.schemePuBuGn, d3.interpolatePuBuGn)],
    ['purd', scheme9(d3.schemePuRd, d3.interpolatePuRd)],
    ['rdpu', scheme9(d3.schemeRdPu, d3.interpolateRdPu)],
    ['ylgn', scheme9(d3.schemeYlGn, d3.interpolateYlGn)],
    ['ylgnbu', scheme9(d3.schemeYlGnBu, d3.interpolateYlGnBu)],
    ['ylorbr', scheme9(d3.schemeYlOrBr, d3.interpolateYlOrBr)],
    ['ylorrd', scheme9(d3.schemeYlOrRd, d3.interpolateYlOrRd)],

    // cyclical
    ['rainbow', schemei(d3.interpolateRainbow)],
    ['sinebow', schemei(d3.interpolateSinebow)],
  ]);

  function scheme9(scheme, interpolate) {
    return ({ length: n }) => {
      n = n > 3 ? Math.floor(n) : 3;
      return n > 9 ? d3.quantize(interpolate, n) : scheme[n];
    };
  }

  function scheme11(scheme, interpolate) {
    return ({ length: n }) => {
      n = n > 3 ? Math.floor(n) : 3;
      return n > 11 ? d3.quantize(interpolate, n) : scheme[n];
    };
  }

  function scheme11r(scheme, interpolate) {
    return ({ length: n }) => {
      n = n > 3 ? Math.floor(n) : 3;
      return n > 11
        ? d3.quantize((t) => interpolate(1 - t), n)
        : scheme[n].slice().reverse();
    };
  }

  function schemei(interpolate) {
    return ({ length: n }) => {
      return d3.quantize(interpolate, n > 0 ? Math.floor(n) : 0);
    };
  }

  function Scheme(scheme) {
    const s = (scheme + '').toLowerCase();
    if (!schemes.has(s)) throw new Error(`unknown scheme: ${s}`);
    return schemes.get(s);
  }

  function ScaleO(
    scale,
    channels,
    { domain = inferDomain(channels), range, reverse, inset },
  ) {
    if ((reverse = !!reverse)) domain = d3.reverse(domain);
    scale.domain(domain);
    if (range !== undefined) {
      // If the range is specified as a function, pass it the domain.
      if (typeof range === 'function') range = range(domain);
      scale.range(range);
    }
    return { type: 'ordinal', reverse, domain, range, scale, inset };
  }

  function ScaleOrdinal(
    key,
    channels,
    {
      scheme,
      type,
      range = registry.get(key) === color
        ? scheme !== undefined
          ? Scheme(scheme)
          : type === 'ordinal'
          ? schemes.get('turbo')
          : d3.schemeTableau10
        : undefined,
      ...options
    },
  ) {
    return ScaleO(d3.scaleOrdinal().unknown(undefined), channels, {
      range,
      ...options,
    });
  }

  function ScalePoint(
    key,
    channels,
    { align = 0.5, padding = 0.5, ...options },
  ) {
    return maybeRound(
      d3.scalePoint().align(align).padding(padding),
      channels,
      options,
    );
  }

  function ScaleBand(
    key,
    channels,
    {
      align = 0.5,
      padding = 0.1,
      paddingInner = padding,
      paddingOuter = key === 'fx' || key === 'fy' ? 0 : padding,
      ...options
    },
  ) {
    return maybeRound(
      d3
        .scaleBand()
        .align(align)
        .paddingInner(paddingInner)
        .paddingOuter(paddingOuter),
      channels,
      options,
    );
  }

  function maybeRound(scale, channels, options = {}) {
    const { round } = options;
    if (round !== undefined) scale.round(round);
    scale = ScaleO(scale, channels, options);
    scale.round = round;
    return scale;
  }

  function inferDomain(channels) {
    const domain = new d3.InternSet();
    for (const { value } of channels) {
      if (value === undefined) continue;
      for (const v of value) domain.add(v);
    }
    return d3.sort(domain, ascendingDefined);
  }

  function Scales(
    channels,
    { inset, round, nice, align, padding, ...options } = {},
  ) {
    const scales = {};
    for (const key of registry.keys()) {
      if (channels.has(key) || options[key]) {
        const scale = Scale(key, channels.get(key), {
          inset: key === 'x' || key === 'y' ? inset : undefined, // not for facet
          round: registry.get(key) === position ? round : undefined, // only for position
          nice,
          align,
          padding,
          ...options[key],
        });
        if (scale) scales[key] = scale;
      }
    }
    return scales;
  }

  // Mutates scale.range!
  function autoScaleRange({ x, y, fx, fy }, dimensions) {
    if (fx) autoScaleRangeX(fx, dimensions);
    if (fy) autoScaleRangeY(fy, dimensions);
    if (x)
      autoScaleRangeX(x, fx ? { width: fx.scale.bandwidth() } : dimensions);
    if (y)
      autoScaleRangeY(y, fy ? { height: fy.scale.bandwidth() } : dimensions);
  }

  function autoScaleRangeX(scale, dimensions) {
    if (scale.range === undefined) {
      const { inset = 0 } = scale;
      const { width, marginLeft = 0, marginRight = 0 } = dimensions;
      scale.scale.range([marginLeft + inset, width - marginRight - inset]);
    }
    autoScaleRound(scale);
  }

  function autoScaleRangeY(scale, dimensions) {
    if (scale.range === undefined) {
      const { inset = 0 } = scale;
      const { height, marginTop = 0, marginBottom = 0 } = dimensions;
      const range = [height - marginBottom - inset, marginTop + inset];
      if (scale.type === 'ordinal') range.reverse();
      scale.scale.range(range);
    }
    autoScaleRound(scale);
  }

  function autoScaleRound(scale) {
    if (
      scale.round === undefined &&
      scale.type === 'ordinal' &&
      scale.scale.step() >= 5
    ) {
      scale.scale.round(true);
    }
  }

  function Scale(key, channels = [], options = {}) {
    switch (inferScaleType(key, channels, options)) {
      case 'diverging':
        return ScaleDiverging(key, channels, options);
      case 'categorical':
      case 'ordinal':
        return ScaleOrdinal(key, channels, options);
      case 'cyclical':
      case 'sequential':
      case 'linear':
        return ScaleLinear(key, channels, options);
      case 'sqrt':
        return ScalePow(key, channels, { ...options, exponent: 0.5 });
      case 'pow':
        return ScalePow(key, channels, options);
      case 'log':
        return ScaleLog(key, channels, options);
      case 'symlog':
        return ScaleSymlog(key, channels, options);
      case 'utc':
        return ScaleUtc(key, channels, options);
      case 'time':
        return ScaleTime(key, channels, options);
      case 'point':
        return ScalePoint(key, channels, options);
      case 'band':
        return ScaleBand(key, channels, options);
      case 'identity':
        return registry.get(key) === position ? ScaleIdentity() : undefined;
      case undefined:
        return;
      default:
        throw new Error(`unknown scale type: ${options.type}`);
    }
  }

  function inferScaleType(key, channels, { type, domain, range }) {
    if (key === 'fx' || key === 'fy') return 'band';
    if (type !== undefined) {
      for (const { type: t } of channels) {
        if (t !== undefined && type !== t) {
          throw new Error(`scale incompatible with channel: ${type} !== ${t}`);
        }
      }
      return type;
    }
    if (registry.get(key) === radius) return 'sqrt';
    if (registry.get(key) === opacity) return 'linear';
    for (const { type } of channels) if (type !== undefined) return type;
    if ((domain || range || []).length > 2) return asOrdinalType(key);
    if (domain !== undefined) {
      if (isOrdinal(domain)) return asOrdinalType(key);
      if (isTemporal(domain)) return 'utc';
      return 'linear';
    }
    // If any channel is ordinal or temporal, it takes priority.
    const values = channels
      .map(({ value }) => value)
      .filter((value) => value !== undefined);
    if (values.some(isOrdinal)) return asOrdinalType(key);
    if (values.some(isTemporal)) return 'utc';
    return 'linear';
  }

  // Positional scales default to a point scale instead of an ordinal scale.
  function asOrdinalType(key) {
    return registry.get(key) === position ? 'point' : 'ordinal';
  }

  const offset =
    typeof window !== 'undefined' && window.devicePixelRatio > 1 ? 0 : 0.5;

  function Style(
    mark,
    {
      fill,
      fillOpacity,
      stroke,
      strokeWidth,
      strokeOpacity,
      strokeLinejoin,
      strokeLinecap,
      strokeMiterlimit,
      strokeDasharray,
      mixBlendMode,
    } = {},
  ) {
    mark.fill = impliedString(fill, 'currentColor');
    mark.fillOpacity = impliedNumber(fillOpacity, 1);
    mark.stroke = impliedString(stroke, 'none');
    mark.strokeWidth = impliedNumber(strokeWidth, 1);
    mark.strokeOpacity = impliedNumber(strokeOpacity, 1);
    mark.strokeLinejoin = impliedString(strokeLinejoin, 'miter');
    mark.strokeLinecap = impliedString(strokeLinecap, 'butt');
    mark.strokeMiterlimit = impliedNumber(strokeMiterlimit, 4);
    mark.strokeDasharray = string(strokeDasharray);
    mark.mixBlendMode = impliedString(mixBlendMode, 'normal');
  }

  function applyIndirectStyles(selection, mark) {
    applyAttr(selection, 'fill', mark.fill);
    applyAttr(selection, 'fill-opacity', mark.fillOpacity);
    applyAttr(selection, 'stroke', mark.stroke);
    applyAttr(selection, 'stroke-width', mark.strokeWidth);
    applyAttr(selection, 'stroke-opacity', mark.strokeOpacity);
    applyAttr(selection, 'stroke-linejoin', mark.strokeLinejoin);
    applyAttr(selection, 'stroke-linecap', mark.strokeLinecap);
    applyAttr(selection, 'stroke-miterlimit', mark.strokeMiterlimit);
    applyAttr(selection, 'stroke-dasharray', mark.strokeDasharray);
  }

  function applyDirectStyles(selection, mark) {
    applyStyle(selection, 'mix-blend-mode', mark.mixBlendMode);
  }

  function applyAttr(selection, name, value) {
    if (value != null) selection.attr(name, value);
  }

  function applyStyle(selection, name, value) {
    if (value != null) selection.style(name, value);
  }

  function applyTransform(selection, x, y, tx, ty) {
    tx = tx ? offset : 0;
    ty = ty ? offset : 0;
    if (x && x.bandwidth) tx += x.bandwidth() / 2;
    if (y && y.bandwidth) ty += y.bandwidth() / 2;
    if (tx || ty) selection.attr('transform', `translate(${tx},${ty})`);
  }

  function impliedString(value, impliedValue) {
    if ((value = string(value)) !== impliedValue) return value;
  }

  function impliedNumber(value, impliedValue) {
    if ((value = number(value)) !== impliedValue) return value;
  }

  function plot(options = {}) {
    const { facet, style, caption } = options;

    // When faceting, wrap all marks in a faceting mark.
    if (facet !== undefined) {
      const { marks } = options;
      const { data } = facet;
      options = { ...options, marks: facets(data, facet, marks) };
    }

    // Flatten any nested marks.
    const marks =
      options.marks === undefined ? [] : options.marks.flat(Infinity);

    // A Map from Mark instance to an object of named channel values.
    const markChannels = new Map();
    const markIndex = new Map();

    // A Map from scale name to an array of associated channels.
    const scaleChannels = new Map();

    // Initialize the marks’ channels, indexing them by mark and scale as needed.
    // Also apply any scale transforms.
    for (const mark of marks) {
      if (markChannels.has(mark)) throw new Error('duplicate mark');
      const { index, channels } = mark.initialize();
      for (const [, channel] of channels) {
        const { scale } = channel;
        if (scale !== undefined) {
          const scaled = scaleChannels.get(scale);
          const { percent, transform = percent ? (x) => x * 100 : undefined } =
            options[scale] || {};
          if (transform !== undefined)
            channel.value = Array.from(channel.value, transform);
          if (scaled) scaled.push(channel);
          else scaleChannels.set(scale, [channel]);
        }
      }
      markChannels.set(mark, channels);
      markIndex.set(mark, index);
    }

    const scaleDescriptors = Scales(scaleChannels, options);
    const scales = ScaleFunctions(scaleDescriptors);
    const axes = Axes(scaleDescriptors, options);
    const dimensions = Dimensions(scaleDescriptors, axes, options);

    autoScaleRange(scaleDescriptors, dimensions);
    autoAxisTicks(scaleDescriptors, axes);
    autoAxisLabels(scaleChannels, scaleDescriptors, axes, dimensions);

    // Normalize the options.
    options = { ...scaleDescriptors, ...dimensions };
    if (axes.x) options.x = { ...options.x, ...axes.x };
    if (axes.y) options.y = { ...options.y, ...axes.y };
    if (axes.fx) options.fx = { ...options.fx, ...axes.fx };
    if (axes.fy) options.fy = { ...options.fy, ...axes.fy };

    // When faceting, render axes for fx and fy instead of x and y.
    const x = facet !== undefined && scales.fx ? 'fx' : 'x';
    const y = facet !== undefined && scales.fy ? 'fy' : 'y';
    if (axes[x]) marks.unshift(axes[x]);
    if (axes[y]) marks.unshift(axes[y]);

    const { width, height } = dimensions;

    const svg = d3
      .create('svg')
      .attr('class', 'plot')
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .each(function () {
        if (typeof style === 'string') this.style = style;
        else Object.assign(this.style, style);
      })
      .node();

    for (const mark of marks) {
      const channels = markChannels.get(mark);
      const index = markIndex.get(mark);
      const node = mark.render(
        index,
        scales,
        values(channels, scales),
        dimensions,
        axes,
      );
      if (node != null) svg.appendChild(node);
    }

    // Wrap the plot in a figure with a caption, if desired.
    if (caption == null) return svg;
    const figure = document.createElement('figure');
    figure.appendChild(svg);
    const figcaption = figure.appendChild(document.createElement('figcaption'));
    figcaption.appendChild(
      caption instanceof Node ? caption : document.createTextNode(caption),
    );
    return figure;
  }

  function Dimensions(
    scales,
    {
      x: { axis: xAxis } = {},
      y: { axis: yAxis } = {},
      fx: { axis: fxAxis } = {},
      fy: { axis: fyAxis } = {},
    },
    {
      width = 640,
      height = autoHeight(scales),
      facet: {
        marginTop: facetMarginTop = fxAxis === 'top' ? 30 : 0,
        marginRight: facetMarginRight = fyAxis === 'right' ? 40 : 0,
        marginBottom: facetMarginBottom = fxAxis === 'bottom' ? 30 : 0,
        marginLeft: facetMarginLeft = fyAxis === 'left' ? 40 : 0,
      } = {},
      marginTop = Math.max(
        (xAxis === 'top' ? 30 : 0) + facetMarginTop,
        yAxis || fyAxis ? 20 : 0.5 - offset,
      ),
      marginRight = Math.max(
        (yAxis === 'right' ? 40 : 0) + facetMarginRight,
        xAxis || fxAxis ? 20 : 0.5 + offset,
      ),
      marginBottom = Math.max(
        (xAxis === 'bottom' ? 30 : 0) + facetMarginBottom,
        yAxis || fyAxis ? 20 : 0.5 + offset,
      ),
      marginLeft = Math.max(
        (yAxis === 'left' ? 40 : 0) + facetMarginLeft,
        xAxis || fxAxis ? 20 : 0.5 - offset,
      ),
    } = {},
  ) {
    return {
      width,
      height,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      facetMarginTop,
      facetMarginRight,
      facetMarginBottom,
      facetMarginLeft,
    };
  }

  function ScaleFunctions(scales) {
    return Object.fromEntries(
      Object.entries(scales).map(([name, { scale }]) => [name, scale]),
    );
  }

  function autoHeight({ y, fy, fx }) {
    const nfy = fy ? fy.scale.domain().length : 1;
    const ny = y
      ? y.type === 'ordinal'
        ? y.scale.domain().length
        : Math.max(7, 17 / nfy)
      : 1;
    return (
      !!(y || fy) * Math.max(1, Math.min(60, ny * nfy)) * 20 + !!fx * 30 + 60
    );
  }

  const curves = new Map([
    ['basis', d3.curveBasis],
    ['basis-closed', d3.curveBasisClosed],
    ['basis-open', d3.curveBasisOpen],
    ['bundle', d3.curveBundle],
    ['bump-x', d3.curveBumpX],
    ['bump-y', d3.curveBumpY],
    ['cardinal', d3.curveCardinal],
    ['cardinal-closed', d3.curveCardinalClosed],
    ['cardinal-open', d3.curveCardinalOpen],
    ['catmull-rom', d3.curveCatmullRom],
    ['catmull-rom-closed', d3.curveCatmullRomClosed],
    ['catmull-rom-open', d3.curveCatmullRomOpen],
    ['linear', d3.curveLinear],
    ['linear-closed', d3.curveLinearClosed],
    ['monotone-x', d3.curveMonotoneX],
    ['monotone-y', d3.curveMonotoneY],
    ['natural', d3.curveNatural],
    ['step', d3.curveStep],
    ['step-after', d3.curveStepAfter],
    ['step-before', d3.curveStepBefore],
  ]);

  function Curve(curve = d3.curveLinear, tension) {
    if (typeof curve === 'function') return curve; // custom curve
    const c = curves.get((curve + '').toLowerCase());
    if (!c) throw new Error(`unknown curve: ${curve}`);
    if (tension !== undefined) {
      switch (c) {
        case d3.curveBundle:
          return c.beta(tension);
        case d3.curveCardinalClosed:
        case d3.curveCardinalOpen:
        case d3.curveCardinal:
          return c.tension(tension);
        case d3.curveCatmullRomClosed:
        case d3.curveCatmullRomOpen:
        case d3.curveCatmullRom:
          return c.alpha(tension);
      }
    }
    return c;
  }

  function stackX({ y1, y = y1, x, ...options } = {}) {
    const [transform, Y, x1, x2] = stack(y, x, 'x', options);
    return { y1, y: Y, x1, x2, x: mid(x1, x2), ...transform };
  }

  function stackX1({ y1, y = y1, x, ...options } = {}) {
    const [transform, Y, X] = stack(y, x, 'x', options);
    return { y1, y: Y, x: X, ...transform };
  }

  function stackX2({ y1, y = y1, x, ...options } = {}) {
    const [transform, Y, , X] = stack(y, x, 'x', options);
    return { y1, y: Y, x: X, ...transform };
  }

  function stackY({ x1, x = x1, y, ...options } = {}) {
    const [transform, X, y1, y2] = stack(x, y, 'y', options);
    return { x1, x: X, y1, y2, y: mid(y1, y2), ...transform };
  }

  function stackY1({ x1, x = x1, y, ...options } = {}) {
    const [transform, X, Y] = stack(x, y, 'y', options);
    return { x1, x: X, y: Y, ...transform };
  }

  function stackY2({ x1, x = x1, y, ...options } = {}) {
    const [transform, X, , Y] = stack(x, y, 'y', options);
    return { x1, x: X, y: Y, ...transform };
  }

  function maybeStackX({ x, x1, x2, ...options } = {}) {
    if (x1 === undefined && x2 == undefined) {
      if (x === undefined) x = identity;
      return stackX({ x, ...options });
    }
    [x1, x2] = maybeZero(x, x1, x2);
    return { ...options, x1, x2 };
  }

  function maybeStackY({ y, y1, y2, ...options } = {}) {
    if (y1 === undefined && y2 == undefined) {
      if (y === undefined) y = identity;
      return stackY({ y, ...options });
    }
    [y1, y2] = maybeZero(y, y1, y2);
    return { ...options, y1, y2 };
  }

  function stack(
    x,
    y = () => 1,
    ky,
    { offset, order, reverse, ...options } = {},
  ) {
    const z = maybeZ(options);
    const [X, setX] = maybeLazyChannel(x);
    const [Y1, setY1] = lazyChannel(y);
    const [Y2, setY2] = lazyChannel(y);
    offset = maybeOffset(offset);
    order = maybeOrder(order, offset, ky);
    return [
      maybeTransform(options, (data, facets) => {
        const X = x == null ? undefined : setX(valueof(data, x));
        const Y = valueof(data, y, Float64Array);
        const Z = valueof(data, z);
        const O = order && order(data, X, Y, Z);
        const n = data.length;
        const Y1 = setY1(new Float64Array(n));
        const Y2 = setY2(new Float64Array(n));
        for (const facet of facets) {
          const stacks = X
            ? Array.from(d3.group(facet, (i) => X[i]).values())
            : [facet];
          if (O) applyOrder(stacks, O);
          for (const stack of stacks) {
            let yn = 0,
              yp = 0;
            if (reverse) stack.reverse();
            for (const i of stack) {
              const y = Y[i];
              if (y < 0) yn = Y2[i] = (Y1[i] = yn) + y;
              else if (y > 0) yp = Y2[i] = (Y1[i] = yp) + y;
              else Y2[i] = Y1[i] = yp; // NaN or zero
            }
          }
          if (offset) offset(stacks, Y1, Y2, Z);
        }
        return { data, facets };
      }),
      X,
      Y1,
      Y2,
    ];
  }

  function maybeOffset(offset) {
    if (offset == null) return;
    switch ((offset + '').toLowerCase()) {
      case 'expand':
        return offsetExpand;
      case 'silhouette':
        return offsetSilhouette;
      case 'wiggle':
        return offsetWiggle;
    }
    throw new Error(`unknown offset: ${offset}`);
  }

  // Given a single stack, returns the minimum and maximum values from the given
  // Y2 column. Note that this relies on Y2 always being the outer column for
  // diverging values.
  function extent(stack, Y2) {
    let min = 0,
      max = 0;
    for (const i of stack) {
      const y = Y2[i];
      if (y < min) min = y;
      if (y > max) max = y;
    }
    return [min, max];
  }

  function offsetExpand(stacks, Y1, Y2) {
    for (const stack of stacks) {
      const [yn, yp] = extent(stack, Y2);
      for (const i of stack) {
        const m = 1 / (yp - yn || 1);
        Y1[i] = m * (Y1[i] - yn);
        Y2[i] = m * (Y2[i] - yn);
      }
    }
  }

  function offsetSilhouette(stacks, Y1, Y2) {
    for (const stack of stacks) {
      const [yn, yp] = extent(stack, Y2);
      for (const i of stack) {
        const m = (yp + yn) / 2;
        Y1[i] -= m;
        Y2[i] -= m;
      }
    }
    offsetZero(stacks, Y1, Y2);
  }

  function offsetWiggle(stacks, Y1, Y2, Z) {
    const prev = new d3.InternMap();
    let y = 0;
    for (const stack of stacks) {
      let j = -1;
      const Fi = stack.map((i) => Math.abs(Y2[i] - Y1[i]));
      const Df = stack.map((i) => {
        j = Z ? Z[i] : ++j;
        const value = Y2[i] - Y1[i];
        const diff = prev.has(j) ? value - prev.get(j) : 0;
        prev.set(j, value);
        return diff;
      });
      const Cf1 = [0, ...d3.cumsum(Df)];
      for (const i of stack) {
        Y1[i] += y;
        Y2[i] += y;
      }
      const s1 = d3.sum(Fi);
      if (s1) y -= d3.sum(Fi, (d, i) => (Df[i] / 2 + Cf1[i]) * d) / s1;
    }
    offsetZero(stacks, Y1, Y2);
  }

  function offsetZero(stacks, Y1, Y2) {
    const m = d3.min(stacks, (stack) => d3.min(stack, (i) => Y1[i]));
    for (const stack of stacks) {
      for (const i of stack) {
        Y1[i] -= m;
        Y2[i] -= m;
      }
    }
  }

  function maybeOrder(order, offset, ky) {
    if (order === undefined && offset === offsetWiggle) return orderInsideOut;
    if (order == null) return;
    if (typeof order === 'string') {
      switch (order.toLowerCase()) {
        case 'value':
        case ky:
          return orderY;
        case 'z':
          return orderZ;
        case 'sum':
          return orderSum;
        case 'appearance':
          return orderAppearance;
        case 'inside-out':
          return orderInsideOut;
      }
      return orderFunction(field(order));
    }
    if (typeof order === 'function') return orderFunction(order);
    return orderGiven(order);
  }

  // by value
  function orderY(data, X, Y) {
    return Y;
  }

  // by location
  function orderZ(order, X, Y, Z) {
    return Z;
  }

  // by sum of value (a.k.a. “ascending”)
  function orderSum(data, X, Y, Z) {
    return orderZDomain(
      Z,
      d3.groupSort(
        range(data),
        (I) => d3.sum(I, (i) => Y[i]),
        (i) => Z[i],
      ),
    );
  }

  // by x = argmax of value
  function orderAppearance(data, X, Y, Z) {
    return orderZDomain(
      Z,
      d3.groupSort(
        range(data),
        (I) => X[d3.greatest(I, (i) => Y[i])],
        (i) => Z[i],
      ),
    );
  }

  // by x = argmax of value, but rearranged inside-out by alternating series
  // according to the sign of a running divergence of sums
  function orderInsideOut(data, X, Y, Z) {
    const I = range(data);
    const K = d3.groupSort(
      I,
      (I) => X[d3.greatest(I, (i) => Y[i])],
      (i) => Z[i],
    );
    const sums = d3.rollup(
      I,
      (I) => d3.sum(I, (i) => Y[i]),
      (i) => Z[i],
    );
    const Kp = [],
      Kn = [];
    let s = 0;
    for (const k of K) {
      if (s < 0) {
        s += sums.get(k);
        Kp.push(k);
      } else {
        s -= sums.get(k);
        Kn.push(k);
      }
    }
    return orderZDomain(Z, Kn.reverse().concat(Kp));
  }

  function orderFunction(f) {
    return (data) => valueof(data, f);
  }

  function orderGiven(domain) {
    return (data, X, Y, Z) => orderZDomain(Z, domain);
  }

  // Given an explicit ordering of distinct values in z, returns a parallel column
  // O that can be used with applyOrder to sort stacks. Note that this is a series
  // order: it will be consistent across stacks.
  function orderZDomain(Z, domain) {
    domain = new d3.InternMap(domain.map((d, i) => [d, i]));
    return Z.map((z) => domain.get(z));
  }

  function applyOrder(stacks, O) {
    for (const stack of stacks) {
      stack.sort((i, j) => ascendingDefined(O[i], O[j]));
    }
  }

  class Area extends Mark {
    constructor(
      data,
      {
        x1,
        y1,
        x2,
        y2,
        z, // optional grouping for multiple series
        title,
        fill,
        fillOpacity,
        stroke,
        strokeOpacity,
        curve,
        tension,
        ...options
      } = {},
    ) {
      const [vstroke, cstroke] = maybeColor(stroke, 'none');
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      const [vfill, cfill] = maybeColor(
        fill,
        cstroke === 'none' ? 'currentColor' : 'none',
      );
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      if (z === undefined && vfill != null) z = vfill;
      if (z === undefined && vstroke != null) z = vstroke;
      super(
        data,
        [
          { name: 'x1', value: x1, scale: 'x' },
          { name: 'y1', value: y1, scale: 'y' },
          { name: 'x2', value: x2, scale: 'x', optional: true },
          { name: 'y2', value: y2, scale: 'y', optional: true },
          { name: 'z', value: z, optional: true },
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      this.curve = Curve(curve, tension);
      Style(this, {
        fill: cfill,
        fillOpacity: cfillOpacity,
        stroke: cstroke,
        strokeMiterlimit: cstroke === 'none' ? undefined : 1,
        strokeOpacity: cstrokeOpacity,
        ...options,
      });
    }
    render(
      I,
      { x, y },
      {
        x1: X1,
        y1: Y1,
        x2: X2 = X1,
        y2: Y2 = Y1,
        z: Z,
        title: L,
        fill: F,
        fillOpacity: FO,
        stroke: S,
        strokeOpacity: SO,
      },
    ) {
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, x, y)
        .call((g) =>
          g
            .selectAll()
            .data(Z ? d3.group(I, (i) => Z[i]).values() : [I])
            .join('path')
            .call(applyDirectStyles, this)
            .call(applyAttr, 'fill', F && (([i]) => F[i]))
            .call(applyAttr, 'fill-opacity', FO && (([i]) => FO[i]))
            .call(applyAttr, 'stroke', S && (([i]) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && (([i]) => SO[i]))
            .attr(
              'd',
              d3
                .area()
                .curve(this.curve)
                .defined(
                  (i) =>
                    defined(X1[i]) &&
                    defined(Y1[i]) &&
                    defined(X2[i]) &&
                    defined(Y2[i]),
                )
                .x0((i) => X1[i])
                .y0((i) => Y1[i])
                .x1((i) => X2[i])
                .y1((i) => Y2[i]),
            )
            .call(titleGroup(L)),
        )
        .node();
    }
  }

  function area(data, options) {
    return new Area(data, options);
  }

  function areaX(data, { y = indexOf, ...options } = {}) {
    return new Area(data, maybeStackX({ ...options, y1: y, y2: undefined }));
  }

  function areaY(data, { x = indexOf, ...options } = {}) {
    return new Area(data, maybeStackY({ ...options, x1: x, x2: undefined }));
  }

  class AbstractBar extends Mark {
    constructor(
      data,
      channels,
      {
        title,
        fill,
        fillOpacity,
        stroke,
        strokeOpacity,
        inset = 0,
        insetTop = inset,
        insetRight = inset,
        insetBottom = inset,
        insetLeft = inset,
        rx,
        ry,
        ...options
      } = {},
    ) {
      const [vstroke, cstroke] = maybeColor(stroke, 'none');
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      const [vfill, cfill] = maybeColor(
        fill,
        cstroke === 'none' ? 'currentColor' : 'none',
      );
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      super(
        data,
        [
          ...channels,
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      Style(this, {
        fill: cfill,
        fillOpacity: cfillOpacity,
        stroke: cstroke,
        strokeOpacity: cstrokeOpacity,
        ...options,
      });
      this.insetTop = number(insetTop);
      this.insetRight = number(insetRight);
      this.insetBottom = number(insetBottom);
      this.insetLeft = number(insetLeft);
      this.rx = impliedString(rx, 'auto'); // number or percentage
      this.ry = impliedString(ry, 'auto');
    }
    render(I, scales, channels, dimensions) {
      const { rx, ry } = this;
      const {
        title: L,
        fill: F,
        fillOpacity: FO,
        stroke: S,
        strokeOpacity: SO,
      } = channels;
      const index = filter$1(I, ...this._positions(channels), F, FO, S, SO);
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(this._transform, scales)
        .call((g) =>
          g
            .selectAll()
            .data(index)
            .join('rect')
            .call(applyDirectStyles, this)
            .attr('x', this._x(scales, channels, dimensions))
            .attr('width', this._width(scales, channels, dimensions))
            .attr('y', this._y(scales, channels, dimensions))
            .attr('height', this._height(scales, channels, dimensions))
            .call(applyAttr, 'fill', F && ((i) => F[i]))
            .call(applyAttr, 'fill-opacity', FO && ((i) => FO[i]))
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && ((i) => SO[i]))
            .call(applyAttr, 'rx', rx)
            .call(applyAttr, 'ry', ry)
            .call(title(L)),
        )
        .node();
    }
    _x(scales, { x: X }, { marginLeft }) {
      const { insetLeft } = this;
      return X ? (i) => X[i] + insetLeft : marginLeft + insetLeft;
    }
    _y(scales, { y: Y }, { marginTop }) {
      const { insetTop } = this;
      return Y ? (i) => Y[i] + insetTop : marginTop + insetTop;
    }
    _width({ x }, { x: X }, { marginRight, marginLeft, width }) {
      const { insetLeft, insetRight } = this;
      const bandwidth = X ? x.bandwidth() : width - marginRight - marginLeft;
      return Math.max(0, bandwidth - insetLeft - insetRight);
    }
    _height({ y }, { y: Y }, { marginTop, marginBottom, height }) {
      const { insetTop, insetBottom } = this;
      const bandwidth = Y ? y.bandwidth() : height - marginTop - marginBottom;
      return Math.max(0, bandwidth - insetTop - insetBottom);
    }
  }

  class BarX extends AbstractBar {
    constructor(data, { x1, x2, y, ...options } = {}) {
      super(
        data,
        [
          { name: 'x1', value: x1, scale: 'x' },
          { name: 'x2', value: x2, scale: 'x' },
          { name: 'y', value: y, scale: 'y', type: 'band', optional: true },
        ],
        options,
      );
    }
    _transform(selection, { x }) {
      selection.call(applyTransform, x, null);
    }
    _positions({ x1: X1, x2: X2, y: Y }) {
      return [X1, X2, Y];
    }
    _x(scales, { x1: X1, x2: X2 }) {
      const { insetLeft } = this;
      return (i) => Math.min(X1[i], X2[i]) + insetLeft;
    }
    _width(scales, { x1: X1, x2: X2 }) {
      const { insetLeft, insetRight } = this;
      return (i) =>
        Math.max(0, Math.abs(X2[i] - X1[i]) - insetLeft - insetRight);
    }
  }

  class BarY extends AbstractBar {
    constructor(data, { x, y1, y2, ...options } = {}) {
      super(
        data,
        [
          { name: 'y1', value: y1, scale: 'y' },
          { name: 'y2', value: y2, scale: 'y' },
          { name: 'x', value: x, scale: 'x', type: 'band', optional: true },
        ],
        options,
      );
    }
    _transform(selection, { y }) {
      selection.call(applyTransform, null, y);
    }
    _positions({ y1: Y1, y2: Y2, x: X }) {
      return [Y1, Y2, X];
    }
    _y(scales, { y1: Y1, y2: Y2 }) {
      const { insetTop } = this;
      return (i) => Math.min(Y1[i], Y2[i]) + insetTop;
    }
    _height(scales, { y1: Y1, y2: Y2 }) {
      const { insetTop, insetBottom } = this;
      return (i) =>
        Math.max(0, Math.abs(Y2[i] - Y1[i]) - insetTop - insetBottom);
    }
  }

  function barX(data, options) {
    return new BarX(data, maybeStackX(options));
  }

  function barY(data, options) {
    return new BarY(data, maybeStackY(options));
  }

  class Cell extends AbstractBar {
    constructor(data, { x, y, ...options } = {}) {
      super(
        data,
        [
          { name: 'x', value: x, scale: 'x', type: 'band', optional: true },
          { name: 'y', value: y, scale: 'y', type: 'band', optional: true },
        ],
        options,
      );
    }
    _transform() {
      // noop
    }
    _positions({ x: X, y: Y }) {
      return [X, Y];
    }
  }

  function cell(data, { x, y, ...options } = {}) {
    [x, y] = maybeTuple(x, y);
    return new Cell(data, { ...options, x, y });
  }

  function cellX(data, { x = indexOf, fill, stroke, ...options } = {}) {
    if (fill === undefined && maybeColor(stroke)[0] === undefined)
      fill = identity;
    return new Cell(data, { ...options, x, fill, stroke });
  }

  function cellY(data, { y = indexOf, fill, stroke, ...options } = {}) {
    if (fill === undefined && maybeColor(stroke)[0] === undefined)
      fill = identity;
    return new Cell(data, { ...options, y, fill, stroke });
  }

  class Dot extends Mark {
    constructor(
      data,
      {
        x,
        y,
        r,
        title,
        fill,
        fillOpacity,
        stroke,
        strokeOpacity,
        ...options
      } = {},
    ) {
      const [vr, cr] = maybeNumber(r, 3);
      const [vfill, cfill] = maybeColor(fill, 'none');
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      const [vstroke, cstroke] = maybeColor(
        stroke,
        cfill === 'none' ? 'currentColor' : 'none',
      );
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      super(
        data,
        [
          { name: 'x', value: x, scale: 'x', optional: true },
          { name: 'y', value: y, scale: 'y', optional: true },
          { name: 'r', value: vr, scale: 'r', optional: true },
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      this.r = cr;
      Style(this, {
        fill: cfill,
        fillOpacity: cfillOpacity,
        stroke: cstroke,
        strokeOpacity: cstrokeOpacity,
        strokeWidth: cstroke === 'none' ? undefined : 1.5,
        ...options,
      });
    }
    render(
      I,
      { x, y },
      {
        x: X,
        y: Y,
        r: R,
        title: L,
        fill: F,
        fillOpacity: FO,
        stroke: S,
        strokeOpacity: SO,
      },
      { width, height, marginTop, marginRight, marginBottom, marginLeft },
    ) {
      let index = filter$1(I, X, Y, F, FO, S, SO);
      if (R) index = index.filter((i) => positive(R[i]));
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, x, y, 0.5, 0.5)
        .call((g) =>
          g
            .selectAll()
            .data(index)
            .join('circle')
            .call(applyDirectStyles, this)
            .attr(
              'cx',
              X ? (i) => X[i] : (marginLeft + width - marginRight) / 2,
            )
            .attr(
              'cy',
              Y ? (i) => Y[i] : (marginTop + height - marginBottom) / 2,
            )
            .attr('r', R ? (i) => R[i] : this.r)
            .call(applyAttr, 'fill', F && ((i) => F[i]))
            .call(applyAttr, 'fill-opacity', FO && ((i) => FO[i]))
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && ((i) => SO[i]))
            .call(title(L)),
        )
        .node();
    }
  }

  function dot(data, { x, y, ...options } = {}) {
    [x, y] = maybeTuple(x, y);
    return new Dot(data, { ...options, x, y });
  }

  function dotX(data, { x = identity, ...options } = {}) {
    return new Dot(data, { ...options, x });
  }

  function dotY(data, { y = identity, ...options } = {}) {
    return new Dot(data, { ...options, y });
  }

  class Frame extends Mark {
    constructor({
      fill = 'none',
      stroke = fill === null || fill === 'none' ? 'currentColor' : 'none',
      inset = 0,
      insetTop = inset,
      insetRight = inset,
      insetBottom = inset,
      insetLeft = inset,
      ...style
    } = {}) {
      super();
      Style(this, { fill, stroke, ...style });
      this.insetTop = number(insetTop);
      this.insetRight = number(insetRight);
      this.insetBottom = number(insetBottom);
      this.insetLeft = number(insetLeft);
    }
    render(
      index,
      scales,
      channels,
      { marginTop, marginRight, marginBottom, marginLeft, width, height },
    ) {
      return d3
        .create('svg:rect')
        .call(applyIndirectStyles, this)
        .call(applyDirectStyles, this)
        .call(applyTransform, null, null, 0.5, 0.5)
        .attr('x', marginLeft + this.insetLeft)
        .attr('y', marginTop + this.insetTop)
        .attr(
          'width',
          width - marginLeft - marginRight - this.insetLeft - this.insetRight,
        )
        .attr(
          'height',
          height - marginTop - marginBottom - this.insetTop - this.insetBottom,
        )
        .node();
    }
  }

  function frame(options) {
    return new Frame(options);
  }

  class Line extends Mark {
    constructor(
      data,
      {
        x,
        y,
        z, // optional grouping for multiple series
        title,
        fill,
        fillOpacity,
        stroke,
        strokeOpacity,
        curve,
        tension,
        ...options
      } = {},
    ) {
      const [vfill, cfill] = maybeColor(fill, 'none');
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      const [vstroke, cstroke] = maybeColor(stroke, 'currentColor');
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      if (z === undefined && vstroke != null) z = vstroke;
      if (z === undefined && vfill != null) z = vfill;
      super(
        data,
        [
          { name: 'x', value: x, scale: 'x' },
          { name: 'y', value: y, scale: 'y' },
          { name: 'z', value: z, optional: true },
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      this.curve = Curve(curve, tension);
      Style(this, {
        fill: cfill,
        fillOpacity: cfillOpacity,
        stroke: cstroke,
        strokeMiterlimit: cstroke === 'none' ? undefined : 1,
        strokeOpacity: cstrokeOpacity,
        strokeWidth: cstroke === 'none' ? undefined : 1.5,
        ...options,
      });
    }
    render(
      I,
      { x, y },
      {
        x: X,
        y: Y,
        z: Z,
        title: L,
        fill: F,
        fillOpacity: FO,
        stroke: S,
        strokeOpacity: SO,
      },
    ) {
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, x, y, 0.5, 0.5)
        .call((g) =>
          g
            .selectAll()
            .data(Z ? d3.group(I, (i) => Z[i]).values() : [I])
            .join('path')
            .call(applyDirectStyles, this)
            .call(applyAttr, 'fill', F && (([i]) => F[i]))
            .call(applyAttr, 'fill-opacity', FO && (([i]) => FO[i]))
            .call(applyAttr, 'stroke', S && (([i]) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && (([i]) => SO[i]))
            .attr(
              'd',
              d3
                .line()
                .curve(this.curve)
                .defined((i) => defined(X[i]) && defined(Y[i]))
                .x((i) => X[i])
                .y((i) => Y[i]),
            )
            .call(titleGroup(L)),
        )
        .node();
    }
  }

  function line(data, { x, y, ...options } = {}) {
    [x, y] = maybeTuple(x, y);
    return new Line(data, { ...options, x, y });
  }

  function lineX(data, { x = identity, y = indexOf, ...options } = {}) {
    return new Line(data, { ...options, x, y });
  }

  function lineY(data, { x = indexOf, y = identity, ...options } = {}) {
    return new Line(data, { ...options, x, y });
  }

  class Link extends Mark {
    constructor(
      data,
      {
        x1,
        y1,
        x2,
        y2,
        title,
        fill,
        fillOpacity,
        stroke,
        strokeOpacity,
        curve,
        ...options
      } = {},
    ) {
      const [vfill, cfill] = maybeColor(fill, 'none');
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      const [vstroke, cstroke] = maybeColor(stroke, 'currentColor');
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      super(
        data,
        [
          { name: 'x1', value: x1, scale: 'x' },
          { name: 'y1', value: y1, scale: 'y' },
          { name: 'x2', value: x2, scale: 'x' },
          { name: 'y2', value: y2, scale: 'y' },
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      this.curve = Curve(curve);
      Style(this, {
        fill: cfill,
        fillOpacity: cfillOpacity,
        stroke: cstroke,
        strokeMiterlimit: cstroke === 'none' ? undefined : 1,
        strokeOpacity: cstrokeOpacity,
        ...options,
      });
    }
    render(
      I,
      { x, y },
      {
        x1: X1,
        y1: Y1,
        x2: X2,
        y2: Y2,
        title: L,
        stroke: S,
        strokeOpacity: SO,
      },
    ) {
      const index = filter$1(I, X1, Y1, X2, Y2, S, SO);
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, x, y, 0.5, 0.5)
        .call((g) =>
          g
            .selectAll()
            .data(index)
            .join('path')
            .call(applyDirectStyles, this)
            .attr('d', (i) => {
              const p = d3.path();
              const c = this.curve(p);
              c.lineStart();
              c.point(X1[i], Y1[i]);
              c.point(X2[i], Y2[i]);
              c.lineEnd();
              return p + '';
            })
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && ((i) => SO[i]))
            .call(title(L)),
        )
        .node();
    }
  }

  function link(data, options) {
    return new Link(data, options);
  }

  class Rect extends Mark {
    constructor(
      data,
      {
        x1,
        y1,
        x2,
        y2,
        title,
        fill,
        fillOpacity,
        stroke,
        strokeOpacity,
        inset = 0,
        insetTop = inset,
        insetRight = inset,
        insetBottom = inset,
        insetLeft = inset,
        rx,
        ry,
        ...options
      } = {},
    ) {
      const [vstroke, cstroke] = maybeColor(stroke, 'none');
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      const [vfill, cfill] = maybeColor(
        fill,
        cstroke === 'none' ? 'currentColor' : 'none',
      );
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      super(
        data,
        [
          { name: 'x1', value: x1, scale: 'x' },
          { name: 'y1', value: y1, scale: 'y' },
          { name: 'x2', value: x2, scale: 'x' },
          { name: 'y2', value: y2, scale: 'y' },
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      Style(this, {
        fill: cfill,
        fillOpacity: cfillOpacity,
        stroke: cstroke,
        strokeOpacity: cstrokeOpacity,
        ...options,
      });
      this.insetTop = number(insetTop);
      this.insetRight = number(insetRight);
      this.insetBottom = number(insetBottom);
      this.insetLeft = number(insetLeft);
      this.rx = impliedString(rx, 'auto'); // number or percentage
      this.ry = impliedString(ry, 'auto');
    }
    render(
      I,
      { x, y },
      {
        x1: X1,
        y1: Y1,
        x2: X2,
        y2: Y2,
        title: L,
        fill: F,
        fillOpacity: FO,
        stroke: S,
        strokeOpacity: SO,
      },
    ) {
      const { rx, ry } = this;
      const index = filter$1(I, X1, Y2, X2, Y2, F, FO, S, SO);
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, x, y)
        .call((g) =>
          g
            .selectAll()
            .data(index)
            .join('rect')
            .call(applyDirectStyles, this)
            .attr('x', (i) => Math.min(X1[i], X2[i]) + this.insetLeft)
            .attr('y', (i) => Math.min(Y1[i], Y2[i]) + this.insetTop)
            .attr('width', (i) =>
              Math.max(
                0,
                Math.abs(X2[i] - X1[i]) - this.insetLeft - this.insetRight,
              ),
            )
            .attr('height', (i) =>
              Math.max(
                0,
                Math.abs(Y1[i] - Y2[i]) - this.insetTop - this.insetBottom,
              ),
            )
            .call(applyAttr, 'fill', F && ((i) => F[i]))
            .call(applyAttr, 'fill-opacity', FO && ((i) => FO[i]))
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && ((i) => SO[i]))
            .call(applyAttr, 'rx', rx)
            .call(applyAttr, 'ry', ry)
            .call(title(L)),
        )
        .node();
    }
  }

  function rect(data, options) {
    return new Rect(data, options);
  }

  function rectX(data, options) {
    return new Rect(data, maybeStackX(options));
  }

  function rectY(data, options) {
    return new Rect(data, maybeStackY(options));
  }

  class RuleX extends Mark {
    constructor(
      data,
      {
        x,
        y1,
        y2,
        title,
        stroke,
        inset = 0,
        insetTop = inset,
        insetBottom = inset,
        ...options
      } = {},
    ) {
      const [vstroke, cstroke] = maybeColor(stroke, 'currentColor');
      super(
        data,
        [
          { name: 'x', value: x, scale: 'x', optional: true },
          { name: 'y1', value: y1, scale: 'y', optional: true },
          { name: 'y2', value: y2, scale: 'y', optional: true },
          { name: 'title', value: title, optional: true },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
        ],
        options,
      );
      Style(this, { stroke: cstroke, ...options });
      this.insetTop = number(insetTop);
      this.insetBottom = number(insetBottom);
    }
    render(
      I,
      { x, y },
      { x: X, y1: Y1, y2: Y2, title: L, stroke: S },
      { width, height, marginTop, marginRight, marginLeft, marginBottom },
    ) {
      const index = filter$1(I, X, Y1, Y2, S);
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, X && x, null, 0.5, 0)
        .call((g) =>
          g
            .selectAll('line')
            .data(index)
            .join('line')
            .call(applyDirectStyles, this)
            .attr(
              'x1',
              X ? (i) => X[i] : (marginLeft + width - marginRight) / 2,
            )
            .attr(
              'x2',
              X ? (i) => X[i] : (marginLeft + width - marginRight) / 2,
            )
            .attr(
              'y1',
              Y1 ? (i) => Y1[i] + this.insetTop : marginTop + this.insetTop,
            )
            .attr(
              'y2',
              Y2
                ? y.bandwidth
                  ? (i) => Y2[i] + y.bandwidth() - this.insetBottom
                  : (i) => Y2[i] - this.insetBottom
                : height - marginBottom - this.insetBottom,
            )
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(title(L)),
        )
        .node();
    }
  }

  class RuleY extends Mark {
    constructor(
      data,
      {
        x1,
        x2,
        y,
        title,
        stroke,
        inset = 0,
        insetRight = inset,
        insetLeft = inset,
        ...options
      } = {},
    ) {
      const [vstroke, cstroke] = maybeColor(stroke, 'currentColor');
      super(
        data,
        [
          { name: 'y', value: y, scale: 'y', optional: true },
          { name: 'x1', value: x1, scale: 'x', optional: true },
          { name: 'x2', value: x2, scale: 'x', optional: true },
          { name: 'title', value: title, optional: true },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
        ],
        options,
      );
      Style(this, { stroke: cstroke, ...options });
      this.insetRight = number(insetRight);
      this.insetLeft = number(insetLeft);
    }
    render(
      I,
      { x, y },
      { y: Y, x1: X1, x2: X2, title: L, stroke: S },
      { width, height, marginTop, marginRight, marginLeft, marginBottom },
    ) {
      const index = filter$1(I, Y, X1, X2);
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(applyTransform, null, Y && y, 0, 0.5)
        .call((g) =>
          g
            .selectAll('line')
            .data(index)
            .join('line')
            .call(applyDirectStyles, this)
            .attr(
              'x1',
              X1 ? (i) => X1[i] + this.insetLeft : marginLeft + this.insetLeft,
            )
            .attr(
              'x2',
              X2
                ? x.bandwidth
                  ? (i) => X2[i] + x.bandwidth() - this.insetRight
                  : (i) => X2[i] - this.insetRight
                : width - marginRight - this.insetRight,
            )
            .attr(
              'y1',
              Y ? (i) => Y[i] : (marginTop + height - marginBottom) / 2,
            )
            .attr(
              'y2',
              Y ? (i) => Y[i] : (marginTop + height - marginBottom) / 2,
            )
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(title(L)),
        )
        .node();
    }
  }

  function ruleX(data, { x = identity, y, y1, y2, ...options } = {}) {
    [y1, y2] = maybeOptionalZero(y, y1, y2);
    return new RuleX(data, { ...options, x, y1, y2 });
  }

  function ruleY(data, { y = identity, x, x1, x2, ...options } = {}) {
    [x1, x2] = maybeOptionalZero(x, x1, x2);
    return new RuleY(data, { ...options, y, x1, x2 });
  }

  // For marks specified either as [0, x] or [x1, x2], or nothing.
  function maybeOptionalZero(x, x1, x2) {
    if (x === undefined) {
      if (x1 === undefined) {
        if (x2 !== undefined) return [0, x2];
      } else {
        if (x2 === undefined) return [0, x1];
      }
    } else if (x1 === undefined) {
      return x2 === undefined ? [0, x] : [x, x2];
    } else if (x2 === undefined) {
      return [x, x1];
    }
    return [x1, x2];
  }

  class Text extends Mark {
    constructor(
      data,
      {
        x,
        y,
        text = indexOf,
        title,
        fill,
        fillOpacity,
        textAnchor,
        fontFamily,
        fontSize,
        fontStyle,
        fontVariant,
        fontWeight,
        dx,
        dy = '0.32em',
        rotate,
        ...options
      } = {},
    ) {
      const [vfill, cfill] = maybeColor(fill, 'currentColor');
      const [vfillOpacity, cfillOpacity] = maybeNumber(fillOpacity);
      const [vrotate, crotate] = maybeNumber(rotate, 0);
      const [vfontSize, cfontSize] = maybeNumber(fontSize);
      super(
        data,
        [
          { name: 'x', value: x, scale: 'x', optional: true },
          { name: 'y', value: y, scale: 'y', optional: true },
          { name: 'fontSize', value: numberChannel(vfontSize), optional: true },
          { name: 'rotate', value: numberChannel(vrotate), optional: true },
          { name: 'text', value: text },
          { name: 'title', value: title, optional: true },
          { name: 'fill', value: vfill, scale: 'color', optional: true },
          {
            name: 'fillOpacity',
            value: vfillOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      Style(this, { fill: cfill, fillOpacity: cfillOpacity, ...options });
      this.rotate = crotate;
      this.textAnchor = string(textAnchor);
      this.fontFamily = string(fontFamily);
      this.fontSize = string(cfontSize);
      this.fontStyle = string(fontStyle);
      this.fontVariant = string(fontVariant);
      this.fontWeight = string(fontWeight);
      this.dx = string(dx);
      this.dy = string(dy);
    }
    render(
      I,
      { x, y },
      {
        x: X,
        y: Y,
        rotate: R,
        text: T,
        title: L,
        fill: F,
        fillOpacity: FO,
        fontSize: FS,
      },
      { width, height, marginTop, marginRight, marginBottom, marginLeft },
    ) {
      const { rotate } = this;
      const index = filter$1(I, X, Y, F, FO, R).filter((i) => nonempty(T[i]));
      const cx = (marginLeft + width - marginRight) / 2;
      const cy = (marginTop + height - marginBottom) / 2;
      return d3
        .create('svg:g')
        .call(applyIndirectTextStyles, this)
        .call(applyTransform, x, y, 0.5, 0.5)
        .call((g) =>
          g
            .selectAll()
            .data(index)
            .join('text')
            .call(applyDirectTextStyles, this)
            .call(
              R
                ? (text) =>
                    text.attr(
                      'transform',
                      X && Y
                        ? (i) => `translate(${X[i]},${Y[i]}) rotate(${R[i]})`
                        : X
                        ? (i) => `translate(${X[i]},${cy}) rotate(${R[i]})`
                        : Y
                        ? (i) => `translate(${cx},${Y[i]}) rotate(${R[i]})`
                        : (i) => `translate(${cx},${cy}) rotate(${R[i]})`,
                    )
                : rotate
                ? (text) =>
                    text.attr(
                      'transform',
                      X && Y
                        ? (i) => `translate(${X[i]},${Y[i]}) rotate(${rotate})`
                        : X
                        ? (i) => `translate(${X[i]},${cy}) rotate(${rotate})`
                        : Y
                        ? (i) => `translate(${cx},${Y[i]}) rotate(${rotate})`
                        : `translate(${cx},${cy}) rotate(${rotate})`,
                    )
                : (text) =>
                    text
                      .attr('x', X ? (i) => X[i] : cx)
                      .attr('y', Y ? (i) => Y[i] : cy),
            )
            .call(applyAttr, 'fill', F && ((i) => F[i]))
            .call(applyAttr, 'fill-opacity', FO && ((i) => FO[i]))
            .call(applyAttr, 'font-size', FS && ((i) => FS[i]))
            .text((i) => T[i])
            .call(title(L)),
        )
        .node();
    }
  }

  function text(data, { x, y, ...options } = {}) {
    [x, y] = maybeTuple(x, y);
    return new Text(data, { ...options, x, y });
  }

  function textX(data, { x = identity, ...options } = {}) {
    return new Text(data, { ...options, x });
  }

  function textY(data, { y = identity, ...options } = {}) {
    return new Text(data, { ...options, y });
  }

  function applyIndirectTextStyles(selection, mark) {
    applyIndirectStyles(selection, mark);
    applyAttr(selection, 'text-anchor', mark.textAnchor);
    applyStyle(selection, 'font-family', mark.fontFamily);
    applyStyle(selection, 'font-size', mark.fontSize);
    applyStyle(selection, 'font-style', mark.fontStyle);
    applyStyle(selection, 'font-variant', mark.fontVariant);
    applyStyle(selection, 'font-weight', mark.fontWeight);
  }

  function applyDirectTextStyles(selection, mark) {
    applyDirectStyles(selection, mark);
    applyAttr(selection, 'dx', mark.dx);
    applyAttr(selection, 'dy', mark.dy);
  }

  class AbstractTick extends Mark {
    constructor(
      data,
      channels,
      { title, stroke, strokeOpacity, ...options } = {},
    ) {
      const [vstroke, cstroke] = maybeColor(stroke, 'currentColor');
      const [vstrokeOpacity, cstrokeOpacity] = maybeNumber(strokeOpacity);
      super(
        data,
        [
          ...channels,
          { name: 'title', value: title, optional: true },
          { name: 'stroke', value: vstroke, scale: 'color', optional: true },
          {
            name: 'strokeOpacity',
            value: vstrokeOpacity,
            scale: 'opacity',
            optional: true,
          },
        ],
        options,
      );
      Style(this, {
        stroke: cstroke,
        strokeOpacity: cstrokeOpacity,
        ...options,
      });
    }
    render(I, scales, channels, dimensions) {
      const { x: X, y: Y, title: L, stroke: S, strokeOpacity: SO } = channels;
      const index = filter$1(I, X, Y, S, SO);
      return d3
        .create('svg:g')
        .call(applyIndirectStyles, this)
        .call(this._transform, scales)
        .call((g) =>
          g
            .selectAll('line')
            .data(index)
            .join('line')
            .call(applyDirectStyles, this)
            .attr('x1', this._x1(scales, channels, dimensions))
            .attr('x2', this._x2(scales, channels, dimensions))
            .attr('y1', this._y1(scales, channels, dimensions))
            .attr('y2', this._y2(scales, channels, dimensions))
            .call(applyAttr, 'stroke', S && ((i) => S[i]))
            .call(applyAttr, 'stroke-opacity', SO && ((i) => SO[i]))
            .call(title(L)),
        )
        .node();
    }
  }

  class TickX extends AbstractTick {
    constructor(
      data,
      {
        x,
        y,
        inset = 0,
        insetTop = inset,
        insetBottom = inset,
        ...options
      } = {},
    ) {
      super(
        data,
        [
          { name: 'x', value: x, scale: 'x' },
          { name: 'y', value: y, scale: 'y', type: 'band', optional: true },
        ],
        options,
      );
      this.insetTop = number(insetTop);
      this.insetBottom = number(insetBottom);
    }
    _transform(selection, { x }) {
      selection.call(applyTransform, x, null, 0.5, 0);
    }
    _x1(scales, { x: X }) {
      return (i) => X[i];
    }
    _x2(scales, { x: X }) {
      return (i) => X[i];
    }
    _y1(scales, { y: Y }, { marginTop }) {
      return Y ? (i) => Y[i] + this.insetTop : marginTop + this.insetTop;
    }
    _y2({ y }, { y: Y }, { height, marginBottom }) {
      return Y
        ? (i) => Y[i] + y.bandwidth() - this.insetBottom
        : height - marginBottom - this.insetBottom;
    }
  }

  class TickY extends AbstractTick {
    constructor(
      data,
      {
        x,
        y,
        inset = 0,
        insetRight = inset,
        insetLeft = inset,
        ...options
      } = {},
    ) {
      super(
        data,
        [
          { name: 'y', value: y, scale: 'y' },
          { name: 'x', value: x, scale: 'x', type: 'band', optional: true },
        ],
        options,
      );
      this.insetRight = number(insetRight);
      this.insetLeft = number(insetLeft);
    }
    _transform(selection, { y }) {
      selection.call(applyTransform, null, y, 0, 0.5);
    }
    _x1(scales, { x: X }, { marginLeft }) {
      return X ? (i) => X[i] + this.insetLeft : marginLeft + this.insetLeft;
    }
    _x2({ x }, { x: X }, { width, marginRight }) {
      return X
        ? (i) => X[i] + x.bandwidth() - this.insetRight
        : width - marginRight - this.insetRight;
    }
    _y1(scales, { y: Y }) {
      return (i) => Y[i];
    }
    _y2(scales, { y: Y }) {
      return (i) => Y[i];
    }
  }

  function tickX(data, { x = identity, ...options } = {}) {
    return new TickX(data, { ...options, x });
  }

  function tickY(data, { y = identity, ...options } = {}) {
    return new TickY(data, { ...options, y });
  }

  // Group on {z, fill, stroke}.
  function groupZ(outputs, options) {
    return groupn(null, null, outputs, options);
  }

  // Group on {z, fill, stroke}, then on x.
  function groupX(outputs, options = {}) {
    const { x = identity } = options;
    if (x == null) throw new Error('missing channel: x');
    return groupn(x, null, outputs, options);
  }

  // Group on {z, fill, stroke}, then on y.
  function groupY(outputs, options = {}) {
    const { y = identity } = options;
    if (y == null) throw new Error('missing channel: y');
    return groupn(null, y, outputs, options);
  }

  // Group on {z, fill, stroke}, then on x and y.
  function group(outputs, options = {}) {
    let { x, y } = options;
    [x, y] = maybeTuple(x, y);
    if (x == null) throw new Error('missing channel: x');
    if (y == null) throw new Error('missing channel: y');
    return groupn(x, y, outputs, options);
  }

  function groupn(
    x, // optionally group on x
    y, // optionally group on y
    { data: reduceData = reduceIdentity, ...outputs } = {}, // output channel definitions
    inputs = {}, // input channels and options
  ) {
    reduceData = maybeReduce$1(reduceData, identity);
    outputs = maybeOutputs(outputs, inputs);

    // Produce x and y output channels as appropriate.
    const [GX, setGX] = maybeLazyChannel(x);
    const [GY, setGY] = maybeLazyChannel(y);

    // Greedily materialize the z, fill, and stroke channels (if channels and not
    // constants) so that we can reference them for subdividing groups without
    // computing them more than once.
    const { z, fill, stroke, ...options } = inputs;
    const [GZ, setGZ] = maybeLazyChannel(z);
    const [vfill] = maybeColor(fill);
    const [vstroke] = maybeColor(stroke);
    const [GF = fill, setGF] = maybeLazyChannel(vfill);
    const [GS = stroke, setGS] = maybeLazyChannel(vstroke);

    return {
      ...('z' in inputs && { z: GZ || z }),
      ...('fill' in inputs && { fill: GF || fill }),
      ...('stroke' in inputs && { stroke: GS || stroke }),
      ...maybeTransform(options, (data, facets) => {
        const X = valueof(data, x);
        const Y = valueof(data, y);
        const Z = valueof(data, z);
        const F = valueof(data, vfill);
        const S = valueof(data, vstroke);
        const G = maybeSubgroup(outputs, Z, F, S);
        const groupFacets = [];
        const groupData = [];
        const GX = X && setGX([]);
        const GY = Y && setGY([]);
        const GZ = Z && setGZ([]);
        const GF = F && setGF([]);
        const GS = S && setGS([]);
        let i = 0;
        for (const o of outputs) o.initialize(data);
        for (const facet of facets) {
          const groupFacet = [];
          for (const o of outputs) o.scope('facet', facet);
          for (const [, I] of maybeGroup(facet, G)) {
            for (const [y, gg] of maybeGroup(I, Y)) {
              for (const [x, g] of maybeGroup(gg, X)) {
                groupFacet.push(i++);
                groupData.push(reduceData.reduce(g, data));
                if (X) GX.push(x);
                if (Y) GY.push(y);
                if (Z) GZ.push(Z[g[0]]);
                if (F) GF.push(F[g[0]]);
                if (S) GS.push(S[g[0]]);
                for (const o of outputs) o.reduce(g);
              }
            }
          }
          groupFacets.push(groupFacet);
        }
        return { data: groupData, facets: groupFacets };
      }),
      ...(GX && { x: GX }),
      ...(GY && { y: GY }),
      ...Object.fromEntries(outputs.map(({ name, output }) => [name, output])),
    };
  }

  function maybeOutputs(outputs, inputs) {
    return Object.entries(outputs).map(([name, reduce]) => {
      const value = maybeInput(name, inputs);
      const reducer = maybeReduce$1(reduce, value);
      const [output, setOutput] = lazyChannel(labelof(value, reducer.label));
      let V, O, context;
      return {
        name,
        output,
        initialize(data) {
          V = value === undefined ? data : valueof(data, value);
          O = setOutput([]);
          if (reducer.scope === 'data') {
            context = reducer.reduce(range(data), V);
          }
        },
        scope(scope, I) {
          if (reducer.scope === scope) {
            context = reducer.reduce(I, V);
          }
        },
        reduce(I) {
          O.push(reducer.reduce(I, V, context));
        },
      };
    });
  }

  function maybeGroup(I, X) {
    return X
      ? d3.sort(
          d3.group(I, (i) => X[i]),
          first$1,
        )
      : [[, I]];
  }

  function maybeReduce$1(reduce, value) {
    if (reduce && typeof reduce.reduce === 'function') return reduce;
    if (typeof reduce === 'function') return reduceFunction(reduce);
    switch ((reduce + '').toLowerCase()) {
      case 'first':
        return reduceFirst;
      case 'last':
        return reduceLast;
      case 'count':
        return reduceCount;
      case 'sum':
        return value == null ? reduceCount : reduceSum$1;
      case 'proportion':
        return reduceProportion(value, 'data');
      case 'proportion-facet':
        return reduceProportion(value, 'facet');
      case 'deviation':
        return reduceAccessor(d3.deviation);
      case 'min':
        return reduceAccessor(d3.min);
      case 'max':
        return reduceAccessor(d3.max);
      case 'mean':
        return reduceAccessor(d3.mean);
      case 'median':
        return reduceAccessor(d3.median);
      case 'variance':
        return reduceAccessor(d3.variance);
    }
    throw new Error('invalid reduce');
  }

  function maybeSubgroup(outputs, Z, F, S) {
    return firstof(
      outputs.some((o) => o.name === 'z') ? undefined : Z,
      outputs.some((o) => o.name === 'fill') ? undefined : F,
      outputs.some((o) => o.name === 'stroke') ? undefined : S,
    );
  }

  function reduceFunction(f) {
    return {
      reduce(I, X) {
        return f(take(X, I));
      },
    };
  }

  function reduceAccessor(f) {
    return {
      reduce(I, X) {
        return f(I, (i) => X[i]);
      },
    };
  }

  const reduceIdentity = {
    reduce(I, X) {
      return take(X, I);
    },
  };

  const reduceFirst = {
    reduce(I, X) {
      return X[I[0]];
    },
  };

  const reduceLast = {
    reduce(I, X) {
      return X[I[I.length - 1]];
    },
  };

  const reduceCount = {
    label: 'Frequency',
    reduce(I) {
      return I.length;
    },
  };

  const reduceSum$1 = reduceAccessor(d3.sum);

  function reduceProportion(value, scope) {
    return value == null
      ? {
          scope,
          label: 'Frequency',
          reduce: (I, V, basis = 1) => I.length / basis,
        }
      : { scope, reduce: (I, V, basis = 1) => d3.sum(I, (i) => V[i]) / basis };
  }

  // Group on {z, fill, stroke}, then optionally on y, then bin x.
  function binX(outputs, { inset, insetLeft, insetRight, ...options } = {}) {
    let { x, y } = options;
    x = maybeBinValue(x, options, identity);
    [insetLeft, insetRight] = maybeInset(inset, insetLeft, insetRight);
    return binn(x, null, null, y, outputs, {
      inset,
      insetLeft,
      insetRight,
      ...options,
    });
  }

  // Group on {z, fill, stroke}, then optionally on x, then bin y.
  function binY(outputs, { inset, insetTop, insetBottom, ...options } = {}) {
    let { x, y } = options;
    y = maybeBinValue(y, options, identity);
    [insetTop, insetBottom] = maybeInset(inset, insetTop, insetBottom);
    return binn(null, y, x, null, outputs, {
      inset,
      insetTop,
      insetBottom,
      ...options,
    });
  }

  // Group on {z, fill, stroke}, then bin on x and y.
  function bin(
    outputs,
    { inset, insetTop, insetRight, insetBottom, insetLeft, ...options } = {},
  ) {
    const { x, y } = maybeBinValueTuple(options);
    [insetTop, insetBottom] = maybeInset(inset, insetTop, insetBottom);
    [insetLeft, insetRight] = maybeInset(inset, insetLeft, insetRight);
    return binn(x, y, null, null, outputs, {
      inset,
      insetTop,
      insetRight,
      insetBottom,
      insetLeft,
      ...options,
    });
  }

  function binn(
    bx, // optionally bin on x (exclusive with gx)
    by, // optionally bin on y (exclusive with gy)
    gx, // optionally group on x (exclusive with bx and gy)
    gy, // optionally group on y (exclusive with by and gx)
    { data: reduceData = reduceIdentity, ...outputs } = {}, // output channel definitions
    inputs = {}, // input channels and options
  ) {
    bx = maybeBin(bx);
    by = maybeBin(by);
    reduceData = maybeReduce$1(reduceData, identity);

    // Compute the outputs. Don’t group on a channel if one of the output channels
    // requires it as an input!
    outputs = maybeOutputs(outputs, inputs);
    if (gx != null && hasOutput(outputs, 'x', 'x1', 'x2')) gx = null;
    if (gy != null && hasOutput(outputs, 'y', 'y1', 'y2')) gy = null;

    // Produce x1, x2, y1, and y2 output channels as appropriate (when binning).
    const [BX1, setBX1] = maybeLazyChannel(bx);
    const [BX2, setBX2] = maybeLazyChannel(bx);
    const [BY1, setBY1] = maybeLazyChannel(by);
    const [BY2, setBY2] = maybeLazyChannel(by);

    // Produce x or y output channels as appropriate (when grouping).
    const [k, gk] = gx != null ? [gx, 'x'] : gy != null ? [gy, 'y'] : [];
    const [GK, setGK] = maybeLazyChannel(k);

    // Greedily materialize the z, fill, and stroke channels (if channels and not
    // constants) so that we can reference them for subdividing groups without
    // computing them more than once.
    const { x, y, z, fill, stroke, ...options } = inputs;
    const [GZ, setGZ] = maybeLazyChannel(z);
    const [vfill] = maybeColor(fill);
    const [vstroke] = maybeColor(stroke);
    const [GF = fill, setGF] = maybeLazyChannel(vfill);
    const [GS = stroke, setGS] = maybeLazyChannel(vstroke);

    return {
      ...('z' in inputs && { z: GZ || z }),
      ...('fill' in inputs && { fill: GF || fill }),
      ...('stroke' in inputs && { stroke: GS || stroke }),
      ...maybeTransform(options, (data, facets) => {
        const K = valueof(data, k);
        const Z = valueof(data, z);
        const F = valueof(data, vfill);
        const S = valueof(data, vstroke);
        const G = maybeSubgroup(outputs, Z, F, S);
        const groupFacets = [];
        const groupData = [];
        const GK = K && setGK([]);
        const GZ = Z && setGZ([]);
        const GF = F && setGF([]);
        const GS = S && setGS([]);
        const BX = bx ? bx(data) : [[, , (I) => I]];
        const BY = by ? by(data) : [[, , (I) => I]];
        const BX1 = bx && setBX1([]);
        const BX2 = bx && setBX2([]);
        const BY1 = by && setBY1([]);
        const BY2 = by && setBY2([]);
        let i = 0;
        for (const o of outputs) o.initialize(data);
        for (const facet of facets) {
          const groupFacet = [];
          for (const o of outputs) o.scope('facet', facet);
          for (const [, I] of maybeGroup(facet, G)) {
            for (const [k, g] of maybeGroup(I, K)) {
              for (const [x1, x2, fx] of BX) {
                const bb = fx(g);
                if (bb.length === 0) continue;
                for (const [y1, y2, fy] of BY) {
                  const b = fy(bb);
                  if (b.length === 0) continue;
                  groupFacet.push(i++);
                  groupData.push(reduceData.reduce(b, data));
                  if (K) GK.push(k);
                  if (Z) GZ.push(Z[b[0]]);
                  if (F) GF.push(F[b[0]]);
                  if (S) GS.push(S[b[0]]);
                  if (BX1) BX1.push(x1), BX2.push(x2);
                  if (BY1) BY1.push(y1), BY2.push(y2);
                  for (const o of outputs) o.reduce(b);
                }
              }
            }
          }
          groupFacets.push(groupFacet);
        }
        return { data: groupData, facets: groupFacets };
      }),
      ...(BX1 ? { x1: BX1, x2: BX2, x: mid(BX1, BX2) } : { x }),
      ...(BY1 ? { y1: BY1, y2: BY2, y: mid(BY1, BY2) } : { y }),
      ...(GK && { [gk]: GK }),
      ...Object.fromEntries(outputs.map(({ name, output }) => [name, output])),
    };
  }

  function maybeBinValue(
    value,
    { cumulative, domain, thresholds } = {},
    defaultValue,
  ) {
    value = { ...maybeValue(value) };
    if (value.domain === undefined) value.domain = domain;
    if (value.cumulative === undefined) value.cumulative = cumulative;
    if (value.thresholds === undefined) value.thresholds = thresholds;
    if (value.value === undefined) value.value = defaultValue;
    value.thresholds = maybeThresholds(value.thresholds);
    return value;
  }

  function maybeBinValueTuple(options = {}) {
    let { x, y } = options;
    x = maybeBinValue(x, options);
    y = maybeBinValue(y, options);
    [x.value, y.value] = maybeTuple(x.value, y.value);
    return { x, y };
  }

  function maybeBin(options) {
    if (options == null) return;
    const { value, cumulative, domain = d3.extent, thresholds } = options;
    const bin = (data) => {
      const V = valueof(data, value);
      const bin = d3.bin().value((i) => V[i]);
      if (isTemporal(V)) {
        let [min, max] = typeof domain === 'function' ? domain(V) : domain;
        let t =
          typeof thresholds === 'function' && !isTimeInterval(thresholds)
            ? thresholds(V, min, max)
            : thresholds;
        if (typeof t === 'number') t = d3.utcTickInterval(min, max, t);
        if (isTimeInterval(t)) {
          if (domain === d3.extent) {
            min = t.floor(min);
            max = t.ceil(new Date(+max + 1));
          }
          t = t.range(min, max);
        }
        bin.thresholds(t).domain([min, max]);
      } else {
        bin.thresholds(thresholds).domain(domain);
      }
      let bins = bin(range(data)).map(binset);
      if (cumulative)
        bins = (cumulative < 0 ? bins.reverse() : bins).map(bincumset);
      return bins.filter(nonempty2).map(binfilter);
    };
    bin.label = labelof(value);
    return bin;
  }

  function maybeThresholds(thresholds = d3.thresholdScott) {
    if (typeof thresholds === 'string') {
      switch (thresholds.toLowerCase()) {
        case 'freedman-diaconis':
          return d3.thresholdFreedmanDiaconis;
        case 'scott':
          return d3.thresholdScott;
        case 'sturges':
          return d3.thresholdSturges;
      }
      throw new Error('invalid thresholds');
    }
    return thresholds; // pass array, count, or function to bin.thresholds
  }

  function isTimeInterval(t) {
    return t ? typeof t.range === 'function' : false;
  }

  function hasOutput(outputs, ...names) {
    for (const { name } of outputs) {
      if (names.includes(name)) {
        return true;
      }
    }
    return false;
  }

  function binset(bin) {
    return [bin, new Set(bin)];
  }

  function bincumset([bin], j, bins) {
    return [
      bin,
      {
        get size() {
          for (let k = 0; k <= j; ++k) {
            if (bins[k][1].size) {
              return 1; // a non-empty value
            }
          }
          return 0;
        },
        has(i) {
          for (let k = 0; k <= j; ++k) {
            if (bins[k][1].has(i)) {
              return true;
            }
          }
          return false;
        },
      },
    ];
  }

  function binfilter([{ x0, x1 }, set]) {
    return [x0, x1, (I) => I.filter(set.has, set)]; // TODO optimize
  }

  function nonempty2([, { size }]) {
    return size > 0;
  }

  function maybeInset(inset, inset1, inset2) {
    return inset === undefined && inset1 === undefined && inset2 === undefined
      ? offset
        ? [1, 0]
        : [0.5, 0.5]
      : [inset1, inset2];
  }

  function mapX(m, options = {}) {
    return map(
      Object.fromEntries(
        ['x', 'x1', 'x2']
          .filter((key) => options[key] != null)
          .map((key) => [key, m]),
      ),
      options,
    );
  }

  function mapY(m, options = {}) {
    return map(
      Object.fromEntries(
        ['y', 'y1', 'y2']
          .filter((key) => options[key] != null)
          .map((key) => [key, m]),
      ),
      options,
    );
  }

  function map(outputs = {}, options = {}) {
    const z = maybeZ(options);
    const channels = Object.entries(outputs).map(([key, map]) => {
      const input = maybeInput(key, options);
      if (input == null) throw new Error(`missing channel: ${key}`);
      const [output, setOutput] = lazyChannel(input);
      return { key, input, output, setOutput, map: maybeMap(map) };
    });
    return {
      ...maybeTransform(options, (data, facets) => {
        const Z = valueof(data, z);
        const X = channels.map(({ input }) => valueof(data, input));
        const MX = channels.map(({ setOutput }) =>
          setOutput(new Array(data.length)),
        );
        for (const facet of facets) {
          for (const I of Z ? d3.group(facet, (i) => Z[i]).values() : [facet]) {
            channels.forEach(({ map }, i) => map.map(I, X[i], MX[i]));
          }
        }
        return { data, facets };
      }),
      ...Object.fromEntries(channels.map(({ key, output }) => [key, output])),
    };
  }

  function maybeMap(map) {
    if (map && typeof map.map === 'function') return map;
    if (typeof map === 'function') return mapFunction(map);
    switch ((map + '').toLowerCase()) {
      case 'cumsum':
        return mapCumsum;
    }
    throw new Error('invalid map');
  }

  function mapFunction(f) {
    return {
      map(I, S, T) {
        const M = f(take(S, I));
        if (M.length !== I.length) throw new Error('mismatched length');
        for (let i = 0, n = I.length; i < n; ++i) T[I[i]] = M[i];
      },
    };
  }

  const mapCumsum = {
    map(I, S, T) {
      let sum = 0;
      for (const i of I) T[i] = sum += S[i];
    },
  };

  function normalizeX({ basis, ...options } = {}) {
    return mapX(normalize(basis), options);
  }

  function normalizeY({ basis, ...options } = {}) {
    return mapY(normalize(basis), options);
  }

  function normalize(basis) {
    if (basis === undefined) return normalizeFirst;
    if (typeof basis === 'function')
      return normalizeBasis((I, S) => basis(take(S, I)));
    switch ((basis + '').toLowerCase()) {
      case 'first':
        return normalizeFirst;
      case 'last':
        return normalizeLast;
      case 'mean':
        return normalizeMean;
      case 'median':
        return normalizeMedian;
      case 'sum':
        return normalizeSum;
      case 'extent':
        return normalizeExtent;
    }
    throw new Error('invalid basis');
  }

  function normalizeBasis(basis) {
    return {
      map(I, S, T) {
        const b = +basis(I, S);
        for (const i of I) {
          T[i] = S[i] === null ? NaN : S[i] / b;
        }
      },
    };
  }

  const normalizeExtent = {
    map(I, S, T) {
      const [s1, s2] = d3.extent(I, (i) => S[i]),
        d = s2 - s1;
      for (const i of I) {
        T[i] = S[i] === null ? NaN : (S[i] - s1) / d;
      }
    },
  };

  const normalizeFirst = normalizeBasis((I, S) => {
    for (let i = 0; i < I.length; ++i) {
      const s = S[I[i]];
      if (defined(s)) return s;
    }
  });

  const normalizeLast = normalizeBasis((I, S) => {
    for (let i = I.length - 1; i >= 0; --i) {
      const s = S[I[i]];
      if (defined(s)) return s;
    }
  });

  const normalizeMean = normalizeBasis((I, S) => d3.mean(I, (i) => S[i]));
  const normalizeMedian = normalizeBasis((I, S) => d3.median(I, (i) => S[i]));
  const normalizeSum = normalizeBasis((I, S) => d3.sum(I, (i) => S[i]));

  function windowX({ k, reduce, shift, ...options } = {}) {
    return mapX(window$1(k, reduce, shift), options);
  }

  function windowY({ k, reduce, shift, ...options } = {}) {
    return mapY(window$1(k, reduce, shift), options);
  }

  function window$1(k, reduce, shift) {
    if (!((k = Math.floor(k)) > 0)) throw new Error('invalid k');
    return maybeReduce(reduce)(k, maybeShift(shift, k));
  }

  // TODO rename to anchor = {start, center, end}?
  function maybeShift(shift = 'centered', k) {
    switch ((shift + '').toLowerCase()) {
      case 'centered':
        return (k - 1) >> 1;
      case 'leading':
        return 0;
      case 'trailing':
        return k - 1;
    }
    throw new Error('invalid shift');
  }

  function maybeReduce(reduce = 'mean') {
    if (typeof reduce === 'string') {
      switch (reduce.toLowerCase()) {
        case 'deviation':
          return reduceSubarray(d3.deviation);
        case 'max':
          return reduceSubarray(d3.max);
        case 'mean':
          return reduceMean;
        case 'median':
          return reduceSubarray(d3.median);
        case 'min':
          return reduceSubarray(d3.min);
        case 'sum':
          return reduceSum;
        case 'variance':
          return reduceSubarray(d3.variance);
        case 'difference':
          return reduceDifference;
        case 'ratio':
          return reduceRatio;
      }
    }
    if (typeof reduce !== 'function') throw new Error('invalid reduce');
    return reduceSubarray(reduce);
  }

  function reduceSubarray(f) {
    return (k, s) => ({
      map(I, S, T) {
        const C = Float64Array.from(I, (i) => (S[i] === null ? NaN : S[i]));
        let nans = 0;
        for (let i = 0; i < k - 1; ++i) if (isNaN(C[i])) ++nans;
        for (let i = 0, n = I.length - k + 1; i < n; ++i) {
          if (isNaN(C[i + k - 1])) ++nans;
          T[I[i + s]] = nans === 0 ? f(C.subarray(i, i + k)) : NaN;
          if (isNaN(C[i])) --nans;
        }
      },
    });
  }

  function reduceSum(k, s) {
    return {
      map(I, S, T) {
        let nans = 0;
        let sum = 0;
        for (let i = 0; i < k - 1; ++i) {
          const v = S[I[i]];
          if (v === null || isNaN(v)) ++nans;
          else sum += +v;
        }
        for (let i = 0, n = I.length - k + 1; i < n; ++i) {
          const a = S[I[i]];
          const b = S[I[i + k - 1]];
          if (b === null || isNaN(b)) ++nans;
          else sum += +b;
          T[I[i + s]] = nans === 0 ? sum : NaN;
          if (a === null || isNaN(a)) --nans;
          else sum -= +a;
        }
      },
    };
  }

  function reduceMean(k, s) {
    const sum = reduceSum(k, s);
    return {
      map(I, S, T) {
        sum.map(I, S, T);
        for (let i = 0, n = I.length - k + 1; i < n; ++i) {
          T[I[i + s]] /= k;
        }
      },
    };
  }

  function reduceDifference(k, s) {
    return {
      map(I, S, T) {
        for (let i = 0, n = I.length - k; i < n; ++i) {
          const a = S[I[i]];
          const b = S[I[i + k - 1]];
          T[I[i + s]] = a === null || b === null ? NaN : b - a;
        }
      },
    };
  }

  function reduceRatio(k, s) {
    return {
      map(I, S, T) {
        for (let i = 0, n = I.length - k; i < n; ++i) {
          const a = S[I[i]];
          const b = S[I[i + k - 1]];
          T[I[i + s]] = a === null || b === null ? NaN : b / a;
        }
      },
    };
  }

  function selectFirst(options) {
    return select(first, undefined, options);
  }

  function selectLast(options) {
    return select(last, undefined, options);
  }

  function selectMinX(options = {}) {
    return select(min, options.x, options);
  }

  function selectMinY(options = {}) {
    return select(min, options.y, options);
  }

  function selectMaxX(options = {}) {
    return select(max, options.x, options);
  }

  function selectMaxY(options = {}) {
    return select(max, options.y, options);
  }

  // TODO If the value (for some required channel) is undefined, scan forward?
  function* first(I) {
    yield I[0];
  }

  // TODO If the value (for some required channel) is undefined, scan backward?
  function* last(I) {
    yield I[I.length - 1];
  }

  function* min(I, X) {
    yield d3.least(I, (i) => X[i]);
  }

  function* max(I, X) {
    yield d3.greatest(I, (i) => X[i]);
  }

  function select(selectIndex, v, options) {
    const z = maybeZ(options);
    return maybeTransform(options, (data, facets) => {
      const Z = valueof(data, z);
      const V = valueof(data, v);
      const selectFacets = [];
      for (const facet of facets) {
        const selectFacet = [];
        for (const I of Z ? d3.group(facet, (i) => Z[i]).values() : [facet]) {
          for (const i of selectIndex(I, V)) {
            selectFacet.push(i);
          }
        }
        selectFacets.push(selectFacet);
      }
      return { data, facets: selectFacets };
    });
  }

  exports.Area = Area;
  exports.BarX = BarX;
  exports.BarY = BarY;
  exports.Cell = Cell;
  exports.Dot = Dot;
  exports.Frame = Frame;
  exports.Line = Line;
  exports.Link = Link;
  exports.Mark = Mark;
  exports.Rect = Rect;
  exports.RuleX = RuleX;
  exports.RuleY = RuleY;
  exports.Text = Text;
  exports.TickX = TickX;
  exports.TickY = TickY;
  exports.area = area;
  exports.areaX = areaX;
  exports.areaY = areaY;
  exports.barX = barX;
  exports.barY = barY;
  exports.bin = bin;
  exports.binX = binX;
  exports.binY = binY;
  exports.cell = cell;
  exports.cellX = cellX;
  exports.cellY = cellY;
  exports.dot = dot;
  exports.dotX = dotX;
  exports.dotY = dotY;
  exports.formatIsoDate = formatIsoDate;
  exports.formatMonth = formatMonth;
  exports.formatWeekday = formatWeekday;
  exports.frame = frame;
  exports.group = group;
  exports.groupX = groupX;
  exports.groupY = groupY;
  exports.groupZ = groupZ;
  exports.line = line;
  exports.lineX = lineX;
  exports.lineY = lineY;
  exports.link = link;
  exports.map = map;
  exports.mapX = mapX;
  exports.mapY = mapY;
  exports.normalizeX = normalizeX;
  exports.normalizeY = normalizeY;
  exports.plot = plot;
  exports.rect = rect;
  exports.rectX = rectX;
  exports.rectY = rectY;
  exports.ruleX = ruleX;
  exports.ruleY = ruleY;
  exports.selectFirst = selectFirst;
  exports.selectLast = selectLast;
  exports.selectMaxX = selectMaxX;
  exports.selectMaxY = selectMaxY;
  exports.selectMinX = selectMinX;
  exports.selectMinY = selectMinY;
  exports.stackX = stackX;
  exports.stackX1 = stackX1;
  exports.stackX2 = stackX2;
  exports.stackY = stackY;
  exports.stackY1 = stackY1;
  exports.stackY2 = stackY2;
  exports.text = text;
  exports.textX = textX;
  exports.textY = textY;
  exports.tickX = tickX;
  exports.tickY = tickY;
  exports.valueof = valueof;
  exports.version = version;
  exports.windowX = windowX;
  exports.windowY = windowY;

  Object.defineProperty(exports, '__esModule', { value: true });
});
