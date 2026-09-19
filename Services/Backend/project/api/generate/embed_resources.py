#!/usr/bin/env python3
"""
Script to embed external resources (fonts, JS) into the HTML template for offline use.
Converts font files to base64 data URIs and inlines JavaScript.
"""

import base64
import os
import re

def read_file(filepath):
    """Read file content"""
    with open(filepath, 'rb') as f:
        return f.read()

def base64_encode(data):
    """Encode data to base64"""
    return base64.b64encode(data).decode('utf-8')

def embed_fonts_in_css(css_content, fonts_dir):
    """
    Replace font file references in CSS with base64 data URIs
    """
    # Map of font files to base64 data URIs
    font_map = {}

    # Find all font files in the webfonts directory
    if os.path.exists(fonts_dir):
        for font_file in os.listdir(fonts_dir):
            if font_file.endswith('.woff2'):
                font_path = os.path.join(fonts_dir, font_file)
                font_data = read_file(font_path)
                base64_data = base64_encode(font_data)
                data_uri = f"data:font/woff2;charset=utf-8;base64,{base64_data}"
                font_map[font_file] = data_uri

    # Replace URL references in CSS
    def replace_url(match):
        url_path = match.group(1)
        # Extract just the filename from the path
        filename = url_path.split('/')[-1]

        if filename in font_map:
            return f'url({font_map[filename]})'
        return match.group(0)

    # Replace url(...) references
    css_content = re.sub(r'url\(([^)]+\.woff2)\)', replace_url, css_content)

    return css_content

def create_inline_template(chart_js_path, font_css_path, fonts_dir):
    """
    Create inline CSS and JS content for the HTML template
    """
    # Read Chart.js
    chart_js = read_file(chart_js_path).decode('utf-8')

    # Read Font Awesome CSS
    font_css = read_file(font_css_path).decode('utf-8')

    # Embed fonts in CSS
    font_css_embedded = embed_fonts_in_css(font_css, fonts_dir)

    # Remove .ttf references (we only need woff2)
    font_css_embedded = re.sub(r',url\([^)]+\.ttf\)[^;]*', '', font_css_embedded)

    return chart_js, font_css_embedded

if __name__ == '__main__':
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(script_dir, 'templates')
    chart_js_path = os.path.join(templates_dir, 'chart.js')
    font_css_path = os.path.join(templates_dir, 'fontawesome.css')
    fonts_dir = os.path.join(templates_dir, 'webfonts')

    # Generate embedded content
    print("Embedding external resources...")
    chart_js, font_css = create_inline_template(chart_js_path, font_css_path, fonts_dir)

    # Save embedded CSS to a file
    embedded_css_path = os.path.join(templates_dir, 'fontawesome_embedded.css')
    with open(embedded_css_path, 'w', encoding='utf-8') as f:
        f.write(font_css)

    print(f"✓ Chart.js size: {len(chart_js):,} bytes")
    print(f"✓ Font Awesome CSS size: {len(font_css):,} bytes")
    print(f"✓ Embedded CSS saved to: {embedded_css_path}")
    print("\nNow update downloadable_report.html to use inline resources.")
