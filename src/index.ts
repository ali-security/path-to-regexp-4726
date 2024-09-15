
/**
 * Expose `pathToRegexp`.
 */

export = pathToRegexp;

/**
 * Match matching groups in a regular expression.
 */
const MATCHING_GROUP_REGEXP = /\\.|\\((?:\\?<(.*?)>)?(?!\\?)/g;

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder key.
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Object} options
 * @return {RegExp}
 * @api private
 */

function pathToRegexp(path: any, keys?: any[], options?: any): RegExp {
  options = options || {};
  keys = keys || [];
  const strict = options.strict;
  const end = options.end !== false;
  const flags = options.sensitive ? "" : "i";
  const extraOffset = 0;
  const keysOffset = keys.length;
  let i = 0;
  let name = 0;
  let pos = 0;
  let backtrack = "";
  let m;

  if (path instanceof RegExp) {
    while ((m = MATCHING_GROUP_REGEXP.exec(path.source))) {
      if (m[0][0] === "\\") continue;

      keys.push({
        name: m[1] || name++,
        optional: false,
        offset: m.index
      });
    }

    return path;
  }

  if (Array.isArray(path)) {
    // Map array parts into regexps and return their source. We also pass
    // the same keys and options instance into every generation to get
    // consistent matching groups before we join the sources together.
    path = path.map(function (value: any) {
      return pathToRegexp(value, keys, options).source;
    });

    return new RegExp(path.join("|"), flags);
  }

  path = path.replace(
    /\\.|(\\/)?(\\.)?:(\\w+)(\\(.*?\\))?(\\*)?(\\?)?|[.*]|\\/(\\(.*?|)/g,
    function (
      match: string,
      slash: string,
      format: string,
      key: string,
      capture: string,
      star: string,
      optional: string,
      offset: number
    ) : string {
      pos = offset + match.length;

      if (match[0] === "\\") {
        backtrack += match;
        return match;
      }

      if (match === ".") {
        backtrack += "\\.";
        return "\\.";
      }

      backtrack = slash || format ? "" : path.slice(pos, offset);

      if (match === "*") {
        return "(.*)";
      }

      if (match === "/(") {
        backtrack += "/";
        return "/(?:";
      }

      slash = slash || "";
      format = format ? "\\." : "";
      optional = optional || "";
      capture = capture
        ? capture.replace(/\\.|\\*/, function (m) {
            return m === "*" ? "(.*)" : m;
          })
        : backtrack
        ? "((?:(?!/|" + backtrack + ").)+?)"
        : "([^/" + format + "]+?)";

      keys.push({
        name: key,
        optional: optional === "?" ?? true,
        offset: pos
      });

      let result = "(?:"
        + format + slash + capture
        + (star ? "((?:[/" + format + "].+?)?)" : "")
        + ")"
        + optional;

      return result;
    }
  )

  // This is a workaround for handling unnamed matching groups.
  while ((m = MATCHING_GROUP_REGEXP.exec(path))) {
    if (m[0][0] === "\\") continue;

    if (keysOffset + i === keys.length || keys[keysOffset + i].offset > m.index) {
      keys.splice(keysOffset + i, 0, {
        name: name++,
        optional: false,
        offset: m.index
      });
    }
    i++;
  }

  path += strict ? "" : path[path.length - 1] === "/" ? "?" : "/?";

  // If the path is non-ending, match until the end or a slash.
  if (end) {
    path += "$";
  } else if (path[path.length - 1] !== "/") {
    path += "(?:/|$)";
  }

  return new RegExp("^" + path, flags);
}
