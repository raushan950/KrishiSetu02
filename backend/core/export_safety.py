"""Pure helper for exporting untrusted market labels to spreadsheet-compatible CSV."""

DANGEROUS_LEADERS = ('=', '+', '-', '@')


def spreadsheet_safe(value):
    """Neutralize spreadsheet formulas even when hidden behind whitespace/BOM."""
    text = str(value if value is not None else '')
    head = text.lstrip('\ufeff\t\r\n ')
    if head.startswith(DANGEROUS_LEADERS):
        return "'" + text
    return text


def publishable_count(value, minimum=5):
    """Do not reveal small population counters in institutional summaries."""
    return value if value >= minimum else None
