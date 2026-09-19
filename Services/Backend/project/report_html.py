"""Render scanner-supplied HTML as passive, attribute-free report markup."""

from html import escape
from html.parser import HTMLParser


_TAGS = frozenset({
    "p", "div", "span", "pre", "code", "table", "thead", "tbody", "tfoot",
    "tr", "th", "td", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol",
    "li", "br", "hr", "strong", "em", "b", "i", "blockquote",
})
_VOID = frozenset({"br", "hr"})
_DROP_CONTENT = frozenset({"script", "style"})


class _PassiveReport(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = None

    def handle_starttag(self, tag, attrs):
        if self.hidden:
            return
        if tag in _DROP_CONTENT:
            self.hidden = tag
        elif tag in _TAGS:
            # No attributes: no URLs, handlers, CSS, IDs or namespace changes.
            self.parts.append("<" + tag + ">")

    def handle_endtag(self, tag):
        if self.hidden:
            if tag == self.hidden:
                self.hidden = None
        elif tag in _TAGS and tag not in _VOID:
            self.parts.append("</" + tag + ">")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(escape(data))


def sanitize_report_html(content):
    parser = _PassiveReport()
    parser.feed(str(content or ""))
    parser.close()
    return "".join(parser.parts)
