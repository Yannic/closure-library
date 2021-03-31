/**
 * @license
 * Copyright The Closure Library Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Date/Time parsing library with locale support.
 */


/**
 * Namespace for locale date/time parsing functions
 */
goog.provide('goog.i18n.DateTimeParse');

goog.require('goog.asserts');
goog.require('goog.date');
goog.require('goog.i18n.DateTimeFormat');
goog.require('goog.i18n.DateTimeSymbols');
goog.requireType('goog.i18n.DateTimeSymbolsType');


/**
 * DateTimeParse is for parsing date in a locale-sensitive manner. It allows
 * user to use any customized patterns to parse date-time string under certain
 * locale. Things varies across locales like month name, weekname, field
 * order, etc.
 *
 * This module is the counter-part of DateTimeFormat. They use the same
 * date/time pattern specification, which is borrowed from ICU/JDK.
 *
 * This implementation could parse partial date/time.
 *
 * Time Format Syntax: To specify the time format use a time pattern string.
 * In this pattern, following letters are reserved as pattern letters, which
 * are defined as the following:
 *
 * <pre>
 * Symbol   Meaning                 Presentation        Example
 * ------   -------                 ------------        -------
 * G        era designator          (Text)              AD
 * y#       year                    (Number)            1996
 * M        month in year           (Text & Number)     July & 07
 * d        day in month            (Number)            10
 * h        hour in am/pm (1~12)    (Number)            12
 * H        hour in day (0~23)      (Number)            0
 * m        minute in hour          (Number)            30
 * s        second in minute        (Number)            55
 * S        fractional second       (Number)            978
 * E        day of week             (Text)              Tuesday
 * D        day in year             (Number)            189
 * a        am/pm marker            (Text)              PM
 * k        hour in day (1~24)      (Number)            24
 * K        hour in am/pm (0~11)    (Number)            0
 * z        time zone               (Text)              Pacific Standard Time
 * Z        time zone (RFC 822)     (Number)            -0800
 * v        time zone (generic)     (Text)              Pacific Time
 * '        escape for text         (Delimiter)         'Date='
 * ''       single quote            (Literal)           'o''clock'
 * </pre>
 *
 * The count of pattern letters determine the format. <p>
 * (Text): 4 or more pattern letters--use full form,
 *         less than 4--use short or abbreviated form if one exists.
 *         In parsing, we will always try long format, then short. <p>
 * (Number): the minimum number of digits. <p>
 * (Text & Number): 3 or over, use text, otherwise use number. <p>
 * Any characters that not in the pattern will be treated as quoted text. For
 * instance, characters like ':', '.', ' ', '#' and '@' will appear in the
 * resulting time text even they are not embraced within single quotes. In our
 * current pattern usage, we didn't use up all letters. But those unused
 * letters are strongly discouraged to be used as quoted text without quote.
 * That's because we may use other letter for pattern in future. <p>
 *
 * Examples Using the US Locale:
 *
 * Format Pattern                         Result
 * --------------                         -------
 * "yyyy.MM.dd G 'at' HH:mm:ss vvvv" ->>  1996.07.10 AD at 15:08:56 Pacific Time
 * "EEE, MMM d, ''yy"                ->>  Wed, July 10, '96
 * "h:mm a"                          ->>  12:08 PM
 * "hh 'o''clock' a, zzzz"           ->>  12 o'clock PM, Pacific Daylight Time
 * "K:mm a, vvv"                     ->>  0:00 PM, PT
 * "yyyyy.MMMMM.dd GGG hh:mm aaa"    ->>  01996.July.10 AD 12:08 PM
 *
 * <p> When parsing a date string using the abbreviated year pattern ("yy"),
 * DateTimeParse must interpret the abbreviated year relative to some
 * century. It does this by adjusting dates to be within 80 years before and 20
 * years after the time the parse function is called. For example, using a
 * pattern of "MM/dd/yy" and a DateTimeParse instance created on Jan 1, 1997,
 * the string "01/11/12" would be interpreted as Jan 11, 2012 while the string
 * "05/04/64" would be interpreted as May 4, 1964. During parsing, only
 * strings consisting of exactly two digits, as defined by {@link
 * java.lang.Character#isDigit(char)}, will be parsed into the default
 * century. Any other numeric string, such as a one digit string, a three or
 * more digit string will be interpreted as its face value.
 *
 * <p> If the year pattern does not have exactly two 'y' characters, the year is
 * interpreted literally, regardless of the number of digits. So using the
 * pattern "MM/dd/yyyy", "01/11/12" parses to Jan 11, 12 A.D.
 *
 * <p> When numeric fields abut one another directly, with no intervening
 * delimiter characters, they constitute a run of abutting numeric fields. Such
 * runs are parsed specially. For example, the format "HHmmss" parses the input
 * text "123456" to 12:34:56, parses the input text "12345" to 1:23:45, and
 * fails to parse "1234". In other words, the leftmost field of the run is
 * flexible, while the others keep a fixed width. If the parse fails anywhere in
 * the run, then the leftmost field is shortened by one character, and the
 * entire run is parsed again. This is repeated until either the parse succeeds
 * or the leftmost field is one character in length. If the parse still fails at
 * that point, the parse of the run fails.
 *
 * <p> Now timezone parsing only support GMT:hhmm, GMT:+hhmm, GMT:-hhmm
 */



/**
 * Construct a DateTimeParse based on current locale.
 * @param {string|number} pattern pattern specification or pattern type.
 * @param {!Object=} opt_dateTimeSymbols Optional symbols to use for this
 *     instance rather than the global symbols.
 * @constructor
 * @final
 */
goog.i18n.DateTimeParse = function(pattern, opt_dateTimeSymbols) {
  'use strict';
  goog.asserts.assert(
      opt_dateTimeSymbols !== undefined ||
          goog.i18n.DateTimeSymbols !== undefined,
      'goog.i18n.DateTimeSymbols or explicit symbols must be defined');

  this.patternParts_ = [];

  /**
   * Data structure with all the locale info needed for date formatting.
   * (day/month names, most common patterns, rules for week-end, etc.)
   * @const @private {!goog.i18n.DateTimeSymbolsType}
   */
  this.dateTimeSymbols_ = /** @type {!goog.i18n.DateTimeSymbolsType} */ (
      opt_dateTimeSymbols || goog.i18n.DateTimeSymbols);
  if (typeof pattern == 'number') {
    this.applyStandardPattern_(pattern);
  } else {
    this.applyPattern_(pattern);
  }
};


/**
 * Number of years prior to now that the century used to
 * disambiguate two digit years will begin
 *
 * @type {number}
 */
goog.i18n.DateTimeParse.ambiguousYearCenturyStart = 80;


/**
 * All acceptable pattern characters.
 * @private
 */
goog.i18n.DateTimeParse.PATTERN_CHARS_ = 'GyMdkHmsSEDahKzZvQL';


/**
 * Pattern characters that specify numerical field.
 * @private
 */
goog.i18n.DateTimeParse.NUMERIC_FORMAT_CHARS_ = 'MydhHmsSDkK';


/**
 * Apply a pattern to this Parser. The pattern string will be parsed and saved
 * in "compiled" form.
 * Note: this method is somewhat similar to the pattern parsing method in
 *       datetimeformat. If you see something wrong here, you might want
 *       to check the other.
 * @param {string} pattern It describes the format of date string that need to
 *     be parsed.
 * @private
 */
goog.i18n.DateTimeParse.prototype.applyPattern_ = function(pattern) {
  'use strict';
  var inQuote = false;
  var buf = '';

  for (var i = 0; i < pattern.length; i++) {
    var ch = pattern.charAt(i);

    // handle space, add literal part (if exist), and add space part
    if (ch == ' ') {
      if (buf.length > 0) {
        this.patternParts_.push(
            {text: buf, count: 0, abutStart: false, numeric: false});
        buf = '';
      }
      this.patternParts_.push(
          {text: ' ', count: 0, abutStart: false, numeric: false});
      while (i < pattern.length - 1 && pattern.charAt(i + 1) == ' ') {
        i++;
      }
    } else if (inQuote) {
      // inside quote, except '', just copy or exit
      if (ch == '\'') {
        if (i + 1 < pattern.length && pattern.charAt(i + 1) == '\'') {
          // quote appeared twice continuously, interpret as one quote.
          buf += '\'';
          i++;
        } else {
          // exit quote
          inQuote = false;
        }
      } else {
        // literal
        buf += ch;
      }
    } else if (goog.i18n.DateTimeParse.PATTERN_CHARS_.indexOf(ch) >= 0) {
      // outside quote, it is a pattern char
      if (buf.length > 0) {
        this.patternParts_.push(
            {text: buf, count: 0, abutStart: false, numeric: false});
        buf = '';
      }
      var count = this.getNextCharCount_(pattern, i);
      var numeric = this.isNumericField_(ch, count);
      this.patternParts_.push(
          {text: ch, count: count, abutStart: false, numeric: numeric});
      i += count - 1;
    } else if (ch == '\'') {
      // Two consecutive quotes is a quote literal, inside or outside of quotes.
      if (i + 1 < pattern.length && pattern.charAt(i + 1) == '\'') {
        buf += '\'';
        i++;
      } else {
        inQuote = true;
      }
    } else {
      buf += ch;
    }
  }

  if (buf.length > 0) {
    this.patternParts_.push(
        {text: buf, count: 0, abutStart: false, numeric: false});
  }

  this.markAbutStart_();
};


/**
 * Apply a predefined pattern to this Parser.
 * @param {number} formatType A constant used to identified the predefined
 *     pattern string stored in locale repository.
 * @private
 */
goog.i18n.DateTimeParse.prototype.applyStandardPattern_ = function(formatType) {
  'use strict';
  var pattern;
  // formatType constants are in consecutive numbers. So it can be used to
  // index array in following way.

  // if type is out of range, default to medium date/time format.
  if (formatType > goog.i18n.DateTimeFormat.Format.SHORT_DATETIME) {
    formatType = goog.i18n.DateTimeFormat.Format.MEDIUM_DATETIME;
  }

  if (formatType < 4) {
    pattern = this.dateTimeSymbols_.DATEFORMATS[formatType];
  } else if (formatType < 8) {
    pattern = this.dateTimeSymbols_.TIMEFORMATS[formatType - 4];
  } else {
    pattern = this.dateTimeSymbols_.DATETIMEFORMATS[formatType - 8];
    pattern = pattern.replace(
        '{1}', this.dateTimeSymbols_.DATEFORMATS[formatType - 8]);
    pattern = pattern.replace(
        '{0}', this.dateTimeSymbols_.TIMEFORMATS[formatType - 8]);
  }
  this.applyPattern_(pattern);
};


/**
 * Calculate character repeat count in pattern.
 *
 * @param {string} pattern It describes the format of date string that need to
 *     be parsed.
 * @param {number} start The position of pattern character.
 *
 * @return {number} Repeat count.
 * @private
 */
goog.i18n.DateTimeParse.prototype.getNextCharCount_ = function(pattern, start) {
  'use strict';
  var ch = pattern.charAt(start);
  var next = start + 1;
  while (next < pattern.length && pattern.charAt(next) == ch) {
    next++;
  }
  return next - start;
};


/**
 * Identify the start of an abutting numeric fields' run. Taking pattern
 * "HHmmss" as an example. It will try to parse 2/2/2 characters of the input
 * text, then if that fails, 1/2/2. We only adjust the width of the leftmost
 * field; the others remain fixed. This allows "123456" => 12:34:56, but
 * "12345" => 1:23:45. Likewise, for the pattern "yyyyMMdd" we try 4/2/2,
 * 3/2/2, 2/2/2, and finally 1/2/2. The first field of connected numeric
 * fields will be marked as abutStart, its width can be reduced to accommodate
 * others.
 *
 * @private
 */
goog.i18n.DateTimeParse.prototype.markAbutStart_ = function() {
  'use strict';
  // abut parts are continuous numeric parts. abutStart is the switch
  // point from non-abut to abut
  var abut = false;

  for (var i = 0; i < this.patternParts_.length; i++) {
    if (this.patternParts_[i].numeric) {
      // if next part is not following abut sequence, and is numeric
      if (!abut && i + 1 < this.patternParts_.length &&
          this.patternParts_[i + 1].numeric) {
        abut = true;
        this.patternParts_[i].abutStart = true;
      }
    } else {
      abut = false;
    }
  }
};


/**
 * Check if the pattern part is a numeric field.
 *
 * @param {string} ch pattern character
 * @param {number} count pattern character count
 *
 * @return {boolean} true if the pattern part is numeric field.
 * @private
 */
goog.i18n.DateTimeParse.prototype.isNumericField_ = function(ch, count) {
  'use strict';
  if (count <= 0) {
    return false;
  }
  var i = goog.i18n.DateTimeParse.NUMERIC_FORMAT_CHARS_.indexOf(ch);
  return i > 0 || i == 0 && count < 3;
};


/**
 * Parse the given string and fill parsed values into date object. The existing
 * values of any temporal fields of `date` not parsed from `text` are unchanged.
 * This version does not validate that the result is a valid date/time.
 * @param {string} text The string being parsed.
 * @param {goog.date.DateLike} date The Date object to hold the parsed date.
 * @param {!goog.i18n.DateTimeParse.ParseOptions=} options The options object.
 * @return {number} How many characters parser advanced.
 */
goog.i18n.DateTimeParse.prototype.parse = function(text, date, options) {
  'use strict';
  var validate = false;
  if (options) {
    validate = options.validate || false;
  }

  var cal = new goog.i18n.DateTimeParse.MyDate_();
  var parsePos = [0];

  for (var i = 0; i < this.patternParts_.length; i++) {
    if (this.patternParts_[i].count == 0) {
      // Handle literal pattern characters.
      if (this.subParseLiteral_(text, parsePos, this.patternParts_[i])) {
        continue;
      }
      return 0;
    }

    if (this.patternParts_[i].abutStart) {
      // Handle fields within a run of abutting numeric fields.
      var partsParsed = this.subParseAbut_(text, parsePos, i, cal);
      if (partsParsed <= 0) {
        return 0;
      }
      i += partsParsed - 1;
      continue;
    }

    // Handle non-numeric fields and non-abutting numeric fields.
    if (!this.subParse_(text, parsePos, this.patternParts_[i], 0, cal)) {
      return 0;
    }
  }

  // return progress
  return cal.calcDate_(date, validate) ? parsePos[0] : 0;
};


/**
 * Parse the given string and fill info into date object. This version will
 * validate that the result is a valid date/time.
 * @param {string} text The string being parsed.
 * @param {goog.date.DateLike} date The Date object to hold the parsed date.
 * @return {number} How many characters parser advanced.
 * @deprecated Use goog.i18n.DateTimeParse.parse with the validate option
 *     instead.
 */
goog.i18n.DateTimeParse.prototype.strictParse = function(text, date) {
  'use strict';
  return this.parse(text, date, {validate: true});
};


/**
 * Parse a run of abutting numeric pattern parts. Take the pattern "HHmmss" as
 * an example. We will try to parse 2/2/2 characters of the input text, then if
 * that fails, 1/2/2. We only adjust the width of the leftmost field; the others
 * remain fixed. This allows "123456" => 12:34:56, but "12345" => 1:23:45.
 * Likewise, for the pattern "yyyyMMdd" we try 4/2/2, 3/2/2, 2/2/2, and finally
 * 1/2/2.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos parse position
 * @param {number} abutStart the index of the pattern part starting the run
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object that holds parsed value
 *
 * @return {number} how many pattern parts the parser advanced
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseAbut_ = function(
    text, pos, abutStart, cal) {
  'use strict';
  var start = pos[0];
  var abutPass = 0;

  for (var i = abutStart; i < this.patternParts_.length; i++) {
    if (this.patternParts_[i].count == 0) {
      // Literal pattern parts end abutting runs of numeric fields. Non-numeric
      // fields do not (possibly a bug or undocumented constraint).
      break;
    }
    // If we are at the start of a run of abutting fields, then
    // shorten this field in each pass. If we can't shorten
    // this field any more, then the parse of this set of
    // abutting numeric fields has failed.
    var count = this.patternParts_[i].count;
    if (i == abutStart) {
      count -= abutPass;
      abutPass++;
      if (count == 0) {
        // tried all possible width, fail now
        return 0;
      }
    }

    if (!this.subParse_(text, pos, this.patternParts_[i], count, cal)) {
      // If the parse fails anywhere in the run, back up to the
      // start of the run and retry.
      i = abutStart - 1;
      pos[0] = start;
      continue;
    }
  }

  return i - abutStart;
};


/**
 * Protected method that converts one field of the input string into a
 * numeric field value.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos Parse position.
 * @param {Object} part the pattern part for this field.
 * @param {number} digitCount when > 0, numeric parsing must obey the count.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object that holds parsed value.
 *
 * @return {boolean} True if it parses successfully.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParse_ = function(
    text, pos, part, digitCount, cal) {
  'use strict';
  this.skipSpace_(text, pos);

  if (part.numeric && digitCount > 0) {
    if ((pos[0] + digitCount) > text.length) {
      return false;
    }
  }

  switch (part.text.charAt(0)) {
    case 'G':  // ERA
      var value = this.matchString_(text, pos, this.dateTimeSymbols_.ERAS);
      if (value >= 0) {
        cal.era = value;
      }
      return true;
    case 'M':  // MONTH
    case 'L':  // STANDALONEMONTH
      return this.subParseMonth_(text, pos, digitCount, part, cal);
    case 'E':
      return this.subParseDayOfWeek_(text, pos, cal);
    case 'a':  // AM_PM
      var value = this.matchString_(text, pos, this.dateTimeSymbols_.AMPMS);
      if (value >= 0) {
        cal.ampm = value;
      }
      return true;
    case 'y':  // YEAR
      return this.subParseYear_(text, pos, part, digitCount, cal);
    case 'Q':  // QUARTER
      return this.subParseQuarter_(text, pos, cal);
    case 'd':  // DATE
      this.subParseInt_(text, pos, digitCount, cal, 'day');
      return true;
    case 'S':  // FRACTIONAL_SECOND
      return this.subParseFractionalSeconds_(text, pos, digitCount, cal);
    case 'h':  // HOUR (1..12)
      if (this.subParseInt_(text, pos, digitCount, cal, 'hours')) {
        if (cal.hours == 12) {
          cal.hours = 0;
        }
      }
      return true;
    case 'K':  // HOUR (0..11)
    case 'H':  // HOUR_OF_DAY (0..23)
    case 'k':  // HOUR_OF_DAY (1..24)
      this.subParseInt_(text, pos, digitCount, cal, 'hours');
      return true;
    case 'm':  // MINUTE
      this.subParseInt_(text, pos, digitCount, cal, 'minutes');
      return true;
    case 's':  // SECOND
      this.subParseInt_(text, pos, digitCount, cal, 'seconds');
      return true;
    case 'z':  // ZONE_OFFSET
    case 'Z':  // TIMEZONE_RFC
    case 'v':  // TIMEZONE_GENERIC
      return this.subParseTimeZoneInGMT_(text, pos, cal);
    default:
      return false;
  }
};


/**
 * Parse year field. Year field is special because
 * 1) two digit year need to be resolved.
 * 2) we allow year to take a sign.
 * 3) year field participate in abut processing.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos Parse position.
 * @param {Object} part the pattern part for this field.
 * @param {number} digitCount when > 0, numeric parsing must obey the count.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 *
 * @return {boolean} True if successful.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseYear_ = function(
    text, pos, part, digitCount, cal) {
  'use strict';
  var start = pos[0];
  // This awkward implementation preserves an existing behavioral quirk.
  // digitCount (for abutting patterns) is ignored for signed years.
  var value = this.parseInt_(text, pos, digitCount);
  if (value == null) {
    value = this.parseInt_(text, pos, 0, /* allowSigned= */ true);
  }
  if (value == null) {
    return false;
  }

  // only if 2 digit was actually parsed, and pattern say it has 2 digit.
  if (value >= 0 && pos[0] - start == 2 && part.count == 2) {
    cal.setTwoDigitYear_(value);
  } else {
    cal.year = value;
  }
  return true;
};


/**
 * Parse Month field.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos Parse position.
 * @param {number} digitCount when > 0, numeric parsing must obey the count.
 * @param {Object} part the pattern part
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 *
 * @return {boolean} True if parsing successful.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseMonth_ = function(
    text, pos, digitCount, part, cal) {
  'use strict';
  if (part.numeric && this.subParseInt_(text, pos, digitCount, cal, 'month')) {
    cal.month = cal.month - 1;
    return true;
  }

  // month is symbols, i.e., MMM, MMMM, LLL or LLLL
  // Want to be able to parse both short and long forms.
  // Try count == 4 first
  var months = this.dateTimeSymbols_.MONTHS
                   .concat(this.dateTimeSymbols_.STANDALONEMONTHS)
                   .concat(this.dateTimeSymbols_.SHORTMONTHS)
                   .concat(this.dateTimeSymbols_.STANDALONESHORTMONTHS);
  var value = this.matchString_(text, pos, months);
  if (value < 0) {
    return false;
  }
  // The months variable is multiple of 12, so we have to get the actual
  // month index by modulo 12.
  cal.month = (value % 12);
  return true;
};


/**
 * Parse Quarter field.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos Parse position.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 *
 * @return {boolean} True if parsing successful.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseQuarter_ = function(text, pos, cal) {
  'use strict';
  // Want to be able to parse both short and long forms.
  // Try count == 4 first:
  var value = this.matchString_(text, pos, this.dateTimeSymbols_.QUARTERS);
  if (value < 0) {  // count == 4 failed, now try count == 3
    value = this.matchString_(text, pos, this.dateTimeSymbols_.SHORTQUARTERS);
  }
  if (value < 0) {
    return false;
  }
  cal.month = value * 3;  // First month of quarter.
  cal.day = 1;
  return true;
};


/**
 * Parse Day of week field.
 * @param {string} text the time text to be parsed.
 * @param {Array<number>} pos Parse position.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 *
 * @return {boolean} True if successful.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseDayOfWeek_ = function(
    text, pos, cal) {
  'use strict';
  // Handle both short and long forms.
  // Try count == 4 (DDDD) first:
  var value = this.matchString_(text, pos, this.dateTimeSymbols_.WEEKDAYS);
  if (value < 0) {
    value = this.matchString_(text, pos, this.dateTimeSymbols_.SHORTWEEKDAYS);
  }
  if (value < 0) {
    return false;
  }
  cal.dayOfWeek = value;
  return true;
};


/**
 * Parse fractional seconds field.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos current parse position.
 * @param {number} digitCount when > 0, numeric parsing must obey the count.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 *
 * @return {boolean} True if successful.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseFractionalSeconds_ = function(
    text, pos, digitCount, cal) {
  'use strict';
  var start = pos[0];
  var value = this.parseInt_(text, pos, digitCount);
  if (value == null) {
    return false;
  }
  // Fractional seconds left-justify
  var len = pos[0] - start;
  cal.milliseconds = len < 3 ? value * Math.pow(10, 3 - len) :
                               Math.round(value / Math.pow(10, len - 3));
  return true;
};


/**
 * Parse GMT type timezone.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos Parse position.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 *
 * @return {boolean} True if successful.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseTimeZoneInGMT_ = function(
    text, pos, cal) {
  'use strict';
  // First try to parse generic forms such as GMT-07:00. Do this first
  // in case localized DateFormatZoneData contains the string "GMT"
  // for a zone; in that case, we don't want to match the first three
  // characters of GMT+/-HH:MM etc.

  // For time zones that have no known names, look for strings
  // of the form:
  //    GMT[+-]hours:minutes or
  //    GMT[+-]hhmm or
  //    GMT.
  if (text.indexOf('GMT', pos[0]) == pos[0]) {
    pos[0] += 3;  // 3 is the length of GMT
  }

  // TODO(user): check for named time zones by looking through the locale
  // data from the DateFormatZoneData strings. Should parse both short and long
  // forms.
  // subParseZoneString(text, start, cal);

  // As a last resort, look for numeric timezones of the form
  // [+-]hhmm as specified by RFC 822.  This code is actually
  // a little more permissive than RFC 822.  It will try to do
  // its best with numbers that aren't strictly 4 digits long.

  if (pos[0] >= text.length) {
    cal.tzOffset = 0;
    return true;
  }

  // Look for hours:minutes or hhmm.
  var start = pos[0];
  var value =
      this.parseInt_(text, pos, /* digitCount= */ 0, /* allowSigned= */ true);
  if (value == null) {
    return false;
  }

  var offset;
  if (pos[0] < text.length && text.charAt(pos[0]) == ':') {
    // This is the hours:minutes case
    offset = value * 60;
    pos[0]++;
    value = this.parseInt_(text, pos, /* digitCount= */ 0);
    if (value == null) {
      return false;
    }
    offset += value;
  } else {
    // This is the hhmm case.
    offset = value;
    // Assume "-23".."+23" refers to hours.
    if (offset < 24 && (pos[0] - start) <= 3) {
      offset *= 60;
    } else {
      // todo: this looks questionable, should have more error checking
      offset = offset % 100 + offset / 100 * 60;
    }
  }

  cal.tzOffset = -offset;
  return true;
};


/**
 * Parse unsigned integer pattern characters. These are symbols such as 'd' for
 * date.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos parse position
 * @param {number} maxChars when > 0, at most this many characters are parsed.
 * @param {goog.i18n.DateTimeParse.MyDate_} cal object to hold parsed value.
 * @param {string} key property of `cal` to hold parsed value.
 *
 * @return {boolean} True if it parses successfully.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseInt_ = function(
    text, pos, maxChars, cal, key) {
  'use strict';
  var value = this.parseInt_(text, pos, maxChars);
  if (value == null) {
    return false;
  }
  cal[key] = value;
  return true;
};


/**
 * Parse literal pattern characters. These are any quoted characters and non-
 * alphabetic unquoted characters.
 *
 * @param {string} text the text to be parsed.
 * @param {Array<number>} pos parse position
 * @param {Object} part the pattern part
 *
 * @return {boolean} True if it parses successfully.
 * @private
 */
goog.i18n.DateTimeParse.prototype.subParseLiteral_ = function(text, pos, part) {
  'use strict';
  // A run of white space in the pattern matches a run
  // of white space in the input text.
  if (part.text.charAt(0) == ' ') {
    // Advance over run in input text
    var start = pos[0];
    this.skipSpace_(text, pos);

    // Must see at least one white space char in input
    if (pos[0] > start) {
      return true;
    }
  } else if (text.indexOf(part.text, pos[0]) == pos[0]) {
    pos[0] += part.text.length;
    return true;
  }
  // We fall through to this point if the match fails
  return false;
};


/**
 * Skip space in the string.
 *
 * @param {string} text input string.
 * @param {Array<number>} pos where skip start, and return back where the skip
 *     stops.
 * @private
 */
goog.i18n.DateTimeParse.prototype.skipSpace_ = function(text, pos) {
  'use strict';
  var m = text.substring(pos[0]).match(/^\s+/);
  if (m) {
    pos[0] += m[0].length;
  }
};


/**
 * Parse an integer string and return integer value.
 *
 * @param {string} text string being parsed.
 * @param {Array<number>} pos parse position.
 * @param {number} maxChars when > 0, at most this many characters are parsed.
 * @param {boolean=} allowSigned if true allows a single leading sign character
 *     (+|-) in the input.
 *
 * @return {?number} integer value, or null if the integer cannot be parsed
 * @private
 */
goog.i18n.DateTimeParse.prototype.parseInt_ = function(
    text, pos, maxChars, allowSigned) {
  'use strict';
  text = maxChars > 0 ? text.substring(0, pos[0] + maxChars) : text;
  allowSigned = allowSigned || false;
  // Delocalizes the string containing native digits specified by the locale,
  // replaces the native digits with ASCII digits. Leaves other characters.
  // This is the reverse operation of localizeNumbers_ in datetimeformat.js.
  if (this.dateTimeSymbols_.ZERODIGIT) {
    var parts = [];
    for (var i = pos[0]; i < text.length; i++) {
      var c = text.charCodeAt(i) - this.dateTimeSymbols_.ZERODIGIT;
      parts.push(
          (0 <= c && c <= 9) ? String.fromCharCode(c + 0x30) : text.charAt(i));
    }
    text = parts.join('');
  } else {
    text = text.substring(pos[0]);
  }

  var signRe = allowSigned ? '[+-]?' : '';
  var re = new RegExp(`^${signRe}\\d+`);
  var m = text.match(re);
  if (!m) {
    return null;
  }
  pos[0] += m[0].length;
  return parseInt(m[0], 10);
};


/**
 * Attempt to match the text at a given position against an array of strings.
 * Since multiple strings in the array may match (for example, if the array
 * contains "a", "ab", and "abc", all will match the input string "abcd") the
 * longest match is returned.
 *
 * @param {string} text The string to match to.
 * @param {Array<number>} pos parsing position.
 * @param {Array<string>} data The string array of matching patterns.
 *
 * @return {number} the new start position if matching succeeded; a negative
 *     number indicating matching failure.
 * @private
 */
goog.i18n.DateTimeParse.prototype.matchString_ = function(text, pos, data) {
  'use strict';
  // There may be multiple strings in the data[] array which begin with
  // the same prefix (e.g., Cerven and Cervenec (June and July) in Czech).
  // We keep track of the longest match, and return that. Note that this
  // unfortunately requires us to test all array elements.
  var bestMatchLength = 0;
  var bestMatch = -1;
  var lower_text = text.substring(pos[0]).toLowerCase();
  for (var i = 0; i < data.length; i++) {
    var len = data[i].length;
    // Always compare if we have no match yet; otherwise only compare
    // against potentially better matches (longer strings).
    if (len > bestMatchLength &&
        lower_text.indexOf(data[i].toLowerCase()) == 0) {
      bestMatch = i;
      bestMatchLength = len;
    }
  }
  if (bestMatch >= 0) {
    pos[0] += bestMatchLength;
  }
  return bestMatch;
};


/**
 * Options object for calls to DateTimeParse.prototype.parse.
 * @record
 */
goog.i18n.DateTimeParse.ParseOptions = function() {
  'use strict';
  /**
   * Whether the parsed date/time value should be validated. Setting this to
   * true is the equivalent of calling the now-deprecated
   * DateTimeParse.prototype.strictParse. default == false
   * @type {boolean}
   */
  this.validate;
};


/**
 * This class hold the intermediate parsing result. After all fields are
 * consumed, final result will be resolved from this class.
 * @constructor
 * @private
 */
goog.i18n.DateTimeParse.MyDate_ = function() {};


/**
 * The date's era.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.era;


/**
 * The date's year.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.year;


/**
 * The date's month.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.month;


/**
 * The date's day of month.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.day;


/**
 * The date's hour.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.hours;


/**
 * The date's before/afternoon denominator.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.ampm;


/**
 * The date's minutes.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.minutes;


/**
 * The date's seconds.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.seconds;


/**
 * The date's milliseconds.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.milliseconds;


/**
 * The date's timezone offset.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.tzOffset;


/**
 * The date's day of week. Sunday is 0, Saturday is 6.
 * @type {?number}
 */
goog.i18n.DateTimeParse.MyDate_.prototype.dayOfWeek;


/**
 * 2 digit year special handling. Assuming for example that the
 * defaultCenturyStart is 6/18/1903. This means that two-digit years will be
 * forced into the range 6/18/1903 to 6/17/2003. As a result, years 00, 01, and
 * 02 correspond to 2000, 2001, and 2002. Years 04, 05, etc. correspond
 * to 1904, 1905, etc. If the year is 03, then it is 2003 if the
 * other fields specify a date before 6/18, or 1903 if they specify a
 * date afterwards. As a result, 03 is an ambiguous year. All other
 * two-digit years are unambiguous.
 *
 * @param {number} year 2 digit year value before adjustment.
 * @return {number} disambiguated year.
 * @private
 */
goog.i18n.DateTimeParse.MyDate_.prototype.setTwoDigitYear_ = function(year) {
  'use strict';
  var now = new Date();
  var defaultCenturyStartYear =
      now.getFullYear() - goog.i18n.DateTimeParse.ambiguousYearCenturyStart;
  var ambiguousTwoDigitYear = defaultCenturyStartYear % 100;
  this.ambiguousYear = (year == ambiguousTwoDigitYear);
  year += Math.floor(defaultCenturyStartYear / 100) * 100 +
      (year < ambiguousTwoDigitYear ? 100 : 0);
  return this.year = year;
};


/**
 * Based on the fields set, fill a Date object. For those fields that not
 * set, use the passed in date object's value.
 *
 * @param {goog.date.DateLike} date Date object to be filled.
 * @param {boolean} validation If true, input date will be checked to make
 *     sure it is valid.
 *
 * @return {boolean} false if fields specify a invalid date.
 * @private
 */
goog.i18n.DateTimeParse.MyDate_.prototype.calcDate_ = function(
    date, validation) {
  'use strict';
  // Throw exception if date is null.
  if (date == null) {
    throw new Error('Parameter \'date\' should not be null.');
  }

  // year 0 is 1 BC, and so on.
  if (this.era != undefined && this.year != undefined && this.era == 0 &&
      this.year > 0) {
    this.year = -(this.year - 1);
  }

  if (this.year != undefined) {
    date.setFullYear(this.year);
  }

  // The setMonth and setDate logic is a little tricky. We need to make sure
  // day of month is smaller enough so that it won't cause a month switch when
  // setting month. For example, if data in date is Nov 30, when month is set
  // to Feb, because there is no Feb 30, JS adjust it to Mar 2. So Feb 12 will
  // become  Mar 12.
  var orgDate = date.getDate();

  // Every month has a 1st day, this can actually be anything less than 29.
  date.setDate(1);

  if (this.month != undefined) {
    date.setMonth(this.month);
  }

  if (this.day != undefined) {
    date.setDate(this.day);
  } else {
    var maxDate =
        goog.date.getNumberOfDaysInMonth(date.getFullYear(), date.getMonth());
    date.setDate(orgDate > maxDate ? maxDate : orgDate);
  }

  if (typeof date.setHours === 'function') {
    if (this.hours == undefined) {
      this.hours = date.getHours();
    }
    // adjust ampm
    if (this.ampm != undefined && this.ampm > 0 && this.hours < 12) {
      this.hours += 12;
    }
    date.setHours(this.hours);
  }

  if (typeof date.setMinutes === 'function' && this.minutes != undefined) {
    date.setMinutes(this.minutes);
  }

  if (typeof date.setSeconds === 'function' && this.seconds != undefined) {
    date.setSeconds(this.seconds);
  }

  if (typeof date.setMilliseconds === 'function' &&
      this.milliseconds != undefined) {
    date.setMilliseconds(this.milliseconds);
  }

  // If validation is needed, verify that the uncalculated date fields
  // match the calculated date fields.  We do this before we set the
  // timezone offset, which will skew all of the dates.
  //
  // Don't need to check the day of week as it is guaranteed to be
  // correct or return false below.
  if (validation &&
      (this.year != undefined && this.year != date.getFullYear() ||
       this.month != undefined && this.month != date.getMonth() ||
       this.day != undefined && this.day != date.getDate() ||
       this.hours >= 24 || this.minutes >= 60 || this.seconds >= 60 ||
       this.milliseconds >= 1000)) {
    return false;
  }

  // adjust time zone
  if (this.tzOffset != undefined) {
    var offset = date.getTimezoneOffset();
    date.setTime(date.getTime() + (this.tzOffset - offset) * 60 * 1000);
  }

  // resolve ambiguous year if needed
  if (this.ambiguousYear) {  // the two-digit year == the default start year
    var defaultCenturyStart = new Date();
    defaultCenturyStart.setFullYear(
        defaultCenturyStart.getFullYear() -
        goog.i18n.DateTimeParse.ambiguousYearCenturyStart);
    if (date.getTime() < defaultCenturyStart.getTime()) {
      date.setFullYear(defaultCenturyStart.getFullYear() + 100);
    }
  }

  // dayOfWeek, validation only
  if (this.dayOfWeek != undefined) {
    if (this.day == undefined) {
      // adjust to the nearest day of the week
      var adjustment = (7 + this.dayOfWeek - date.getDay()) % 7;
      if (adjustment > 3) {
        adjustment -= 7;
      }
      var orgMonth = date.getMonth();
      date.setDate(date.getDate() + adjustment);

      // don't let it switch month
      if (date.getMonth() != orgMonth) {
        date.setDate(date.getDate() + (adjustment > 0 ? -7 : 7));
      }
    } else if (this.dayOfWeek != date.getDay()) {
      return false;
    }
  }
  return true;
};
