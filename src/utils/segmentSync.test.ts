import { describe, it, expect } from "vitest";
import { stripHtml, computeSegmentChanges, replaceSegmentTextInHtml } from "./segmentSync";
import type { Segment } from "../types";

function seg(id: number, text: string, startMs = 0, endMs = 1000): Segment {
  return { id, noteId: 1, text, startMs, endMs, speakerLabel: null };
}

describe("stripHtml", () => {
  it("strips inline tags", () => {
    expect(stripHtml("<strong>bold</strong> and <em>italic</em>")).toBe("bold and italic");
  });

  it("adds space for closing block tags", () => {
    expect(stripHtml("<p>First.</p><p>Second.</p>")).toBe("First. Second.");
  });

  it("adds space for headings", () => {
    expect(stripHtml("<h1>Title</h1><p>Body text.</p>")).toBe("Title Body text.");
  });

  it("adds space for list items", () => {
    expect(stripHtml("<ul><li>One</li><li>Two</li><li>Three</li></ul>")).toBe("One Two Three");
  });

  it("handles br tags", () => {
    expect(stripHtml("Line one<br>Line two<br/>Line three")).toBe("Line one Line two Line three");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("Tom &amp; Jerry &lt;3 &gt; &quot;hello&quot; it&#39;s")).toBe(
      'Tom & Jerry <3 > "hello" it\'s'
    );
  });

  it("handles nbsp", () => {
    expect(stripHtml("word&nbsp;word")).toBe("word word");
  });

  it("collapses multiple whitespace", () => {
    expect(stripHtml("<p>  lots   of   space  </p>")).toBe("lots of space");
  });

  it("handles nested formatting in lists", () => {
    expect(
      stripHtml(
        "<ul><li><p><strong>Step 1,</strong> do this.</p></li><li><p><strong>Step 2,</strong> do that.</p></li></ul>"
      )
    ).toBe("Step 1, do this. Step 2, do that.");
  });

  it("handles complex real-world HTML", () => {
    const html =
      "<h1>Title here.</h1><p>Intro paragraph.</p><ul><li><p><strong>Bold part</strong> normal part.</p></li></ul><p></p>";
    expect(stripHtml(html)).toBe("Title here. Intro paragraph. Bold part normal part.");
  });

  it("returns empty string for empty/whitespace HTML", () => {
    expect(stripHtml("<p></p>")).toBe("");
    expect(stripHtml("<p>  </p>")).toBe("");
  });

  it("handles blockquote", () => {
    expect(stripHtml("<blockquote>Quoted text</blockquote><p>Normal.</p>")).toBe(
      "Quoted text Normal."
    );
  });

  it("handles div containers", () => {
    expect(stripHtml("<div>Block one</div><div>Block two</div>")).toBe("Block one Block two");
  });
});

describe("computeSegmentChanges", () => {
  describe("no changes needed", () => {
    it("returns empty when text matches segments", () => {
      const segments = [seg(1, "Hello world."), seg(2, "Second sentence.")];
      const changes = computeSegmentChanges(segments, "Hello world. Second sentence.");
      expect(changes).toEqual([]);
    });

    it("returns empty for formatting-only change (bold)", () => {
      const segments = [seg(1, "Hello world."), seg(2, "Nice day.")];
      const html = "<p><strong>Hello</strong> world.</p><p>Nice day.</p>";
      const plain = stripHtml(html);
      expect(computeSegmentChanges(segments, plain)).toEqual([]);
    });

    it("returns empty for formatting-only change (headings)", () => {
      const segments = [seg(1, "Title."), seg(2, "Body text here.")];
      const html = "<h1>Title.</h1><p>Body text here.</p>";
      expect(computeSegmentChanges(segments, stripHtml(html))).toEqual([]);
    });

    it("returns empty for formatting-only change (lists)", () => {
      const segments = [seg(1, "Item one."), seg(2, "Item two."), seg(3, "Item three.")];
      const html =
        "<ul><li><p>Item one.</p></li><li><p>Item two.</p></li><li><p>Item three.</p></li></ul>";
      expect(computeSegmentChanges(segments, stripHtml(html))).toEqual([]);
    });

    it("returns empty for mixed formatting (heading + bold + list)", () => {
      const segments = [
        seg(1, "Main title."),
        seg(2, "Introduction text."),
        seg(3, "Step one, do this."),
        seg(4, "Step two, do that."),
      ];
      const html =
        "<h1>Main title.</h1><p>Introduction text.</p><ul><li><p><strong>Step one,</strong> do this.</p></li><li><p><strong>Step two,</strong> do that.</p></li></ul>";
      expect(computeSegmentChanges(segments, stripHtml(html))).toEqual([]);
    });
  });

  describe("single segment edit", () => {
    it("updates word within a single segment", () => {
      const segments = [seg(1, "Hello world."), seg(2, "Second sentence.")];
      const changes = computeSegmentChanges(segments, "Hello beautiful world. Second sentence.");
      expect(changes).toEqual([{ id: 1, text: "Hello beautiful world." }]);
    });

    it("removes word from a single segment", () => {
      const segments = [seg(1, "Hello beautiful world."), seg(2, "Second sentence.")];
      const changes = computeSegmentChanges(segments, "Hello world. Second sentence.");
      expect(changes).toEqual([{ id: 1, text: "Hello world." }]);
    });

    it("edits last segment only", () => {
      const segments = [seg(1, "First."), seg(2, "Second."), seg(3, "Third.")];
      const changes = computeSegmentChanges(segments, "First. Second. Last.");
      expect(changes).toEqual([{ id: 3, text: "Last." }]);
    });

    it("edits middle segment only", () => {
      const segments = [seg(1, "Alpha."), seg(2, "Beta."), seg(3, "Gamma.")];
      const changes = computeSegmentChanges(segments, "Alpha. Delta. Gamma.");
      expect(changes).toEqual([{ id: 2, text: "Delta." }]);
    });
  });

  describe("handles empty segments", () => {
    it("skips empty segments in diff", () => {
      const segments = [seg(1, "First."), seg(2, ""), seg(3, ""), seg(4, "Last.")];
      const changes = computeSegmentChanges(segments, "First. Last.");
      expect(changes).toEqual([]);
    });

    it("edits correctly with empty segments present", () => {
      const segments = [seg(1, "Hello."), seg(2, ""), seg(3, "World.")];
      const changes = computeSegmentChanges(segments, "Hello. Earth.");
      expect(changes).toEqual([{ id: 3, text: "Earth." }]);
    });

    it("returns empty for all-empty segments", () => {
      const segments = [seg(1, ""), seg(2, "  "), seg(3, "")];
      const changes = computeSegmentChanges(segments, "anything");
      expect(changes).toEqual([]);
    });
  });

  describe("multi-segment changes", () => {
    it("merges when edit spans two segments", () => {
      const segments = [seg(1, "Hello world."), seg(2, "Good morning."), seg(3, "Bye.")];
      // Replace "world. Good" with "planet. Great"
      const changes = computeSegmentChanges(segments, "Hello planet. Great morning. Bye.");
      expect(changes).toHaveLength(2);
      expect(changes[0].id).toBe(1);
      expect(changes[1].id).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles single segment", () => {
      const segments = [seg(1, "Only segment here.")];
      const changes = computeSegmentChanges(segments, "Only edited segment here.");
      expect(changes).toEqual([{ id: 1, text: "Only edited segment here." }]);
    });

    it("handles appending text at the end", () => {
      const segments = [seg(1, "Hello.")];
      const changes = computeSegmentChanges(segments, "Hello. Extra text.");
      expect(changes).toEqual([{ id: 1, text: "Hello. Extra text." }]);
    });

    it("handles prepending text at the start", () => {
      const segments = [seg(1, "World.")];
      const changes = computeSegmentChanges(segments, "Hello World.");
      expect(changes).toEqual([{ id: 1, text: "Hello World." }]);
    });

    it("handles complete replacement of text", () => {
      const segments = [seg(1, "Old text.")];
      const changes = computeSegmentChanges(segments, "New text.");
      expect(changes).toEqual([{ id: 1, text: "New text." }]);
    });
  });

  describe("real-world scenarios", () => {
    it("correcting a typo in formatted text", () => {
      const segments = [
        seg(1, "TTS Maker lets you create dialogues."),
        seg(2, "Step 1, enter text."),
        seg(3, "Step 2, choose voice."),
      ];
      // User fixes typo "dialogues" -> "dialogs" while text has formatting
      const html =
        "<h1>TTS Maker lets you create dialogs.</h1><p>Step 1, enter text.</p><p>Step 2, choose voice.</p>";
      const changes = computeSegmentChanges(segments, stripHtml(html));
      expect(changes).toEqual([{ id: 1, text: "TTS Maker lets you create dialogs." }]);
    });

    it("adding a word in the middle with formatting preserved", () => {
      const segments = [
        seg(1, "Quick tutorial."),
        seg(2, "Enter the text."),
        seg(3, "Choose the voice."),
      ];
      const html =
        "<p>Quick tutorial.</p><p>Enter the <strong>desired</strong> text.</p><p>Choose the voice.</p>";
      const changes = computeSegmentChanges(segments, stripHtml(html));
      expect(changes).toEqual([{ id: 2, text: "Enter the desired text." }]);
    });

    it("strikethrough does not change plain text", () => {
      const segments = [seg(1, "Keep this."), seg(2, "Remove this.")];
      const html = "<p>Keep this.</p><p><s>Remove this.</s></p>";
      const changes = computeSegmentChanges(segments, stripHtml(html));
      expect(changes).toEqual([]);
    });
  });
});

describe("replaceSegmentTextInHtml", () => {
  it("returns same html when old equals new", () => {
    const html = "<p>Hello world.</p>";
    expect(replaceSegmentTextInHtml(html, "Hello", "Hello")).toBe(html);
  });

  it("replaces plain text in simple paragraph", () => {
    expect(replaceSegmentTextInHtml("<p>Hello world.</p>", "Hello", "Hi")).toBe("<p>Hi world.</p>");
  });

  it("replaces text that spans across inline tags", () => {
    const html = "<p><strong>Step 1,</strong> enter text.</p>";
    // Inline tags within the replaced range get consumed — this is expected
    const result = replaceSegmentTextInHtml(html, "Step 1, enter text.", "Step 1, type text.");
    expect(stripHtml(result)).toBe("Step 1, type text.");
    expect(result).toContain("Step 1, type text.");
  });

  it("replaces text inside a list item", () => {
    const html = "<ul><li><p>First item.</p></li><li><p>Second item.</p></li></ul>";
    expect(replaceSegmentTextInHtml(html, "Second item.", "Updated item.")).toBe(
      "<ul><li><p>First item.</p></li><li><p>Updated item.</p></li></ul>"
    );
  });

  it("replaces text in heading", () => {
    const html = "<h1>Old title.</h1><p>Body.</p>";
    expect(replaceSegmentTextInHtml(html, "Old title.", "New title.")).toBe(
      "<h1>New title.</h1><p>Body.</p>"
    );
  });

  it("handles text not found — returns html unchanged", () => {
    const html = "<p>Hello world.</p>";
    expect(replaceSegmentTextInHtml(html, "Missing text", "New")).toBe(html);
  });

  it("replaces text at the end", () => {
    const html = "<p>Start.</p><p>End.</p>";
    expect(replaceSegmentTextInHtml(html, "End.", "Finish.")).toBe("<p>Start.</p><p>Finish.</p>");
  });

  it("replaces text with entities", () => {
    const html = "<p>Tom &amp; Jerry.</p>";
    expect(replaceSegmentTextInHtml(html, "Tom & Jerry.", "Tom and Jerry.")).toBe(
      "<p>Tom and Jerry.</p>"
    );
  });

  it("handles the real-world desync scenario", () => {
    const html =
      "<p><em>TTS Maker lets you create dialogues.</em></p><ul><li><p>Step 1, enter text.</p></li><li><p>Step 2, choose voice.</p></li></ul>";
    const result = replaceSegmentTextInHtml(html, "Step 1, enter text.", "Step 1, type text.");
    expect(result).toContain("Step 1, type text.");
    expect(result).toContain("Step 2, choose voice.");
  });

  it("preserves formatting around replaced text", () => {
    const html = "<p>Before <strong>bold word</strong> after.</p>";
    expect(replaceSegmentTextInHtml(html, "bold word", "new word")).toBe(
      "<p>Before <strong>new word</strong> after.</p>"
    );
  });
});

describe("round-trip sync", () => {
  describe("Full Text → Segments: edit in HTML propagates to segments correctly", () => {
    it("single word change keeps other segments intact", () => {
      const segments = [
        seg(1, "First sentence here."),
        seg(2, "Second sentence here."),
        seg(3, "Third sentence here."),
      ];
      const html =
        "<h1>First sentence here.</h1><p><strong>Second</strong> sentence changed.</p><p>Third sentence here.</p>";
      const newPlain = stripHtml(html);
      const changes = computeSegmentChanges(segments, newPlain);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({ id: 2, text: "Second sentence changed." });

      // Apply changes and verify full plain text is consistent
      const updatedTexts = segments.map((s) => {
        const change = changes.find((c) => c.id === s.id);
        return change ? change.text : s.text;
      });
      expect(updatedTexts.join(" ")).toBe(newPlain);
    });

    it("edit at segment boundary stays within one segment", () => {
      const segments = [seg(1, "End of first."), seg(2, "Start of second.")];
      const newPlain = "End of first. Beginning of second.";
      const changes = computeSegmentChanges(segments, newPlain);

      expect(changes).toHaveLength(1);
      expect(changes[0].id).toBe(2);

      const updatedTexts = segments.map((s) => {
        const change = changes.find((c) => c.id === s.id);
        return change ? change.text : s.text;
      });
      expect(updatedTexts.join(" ")).toBe(newPlain);
    });
  });

  describe("Segments → Full Text: segment edit propagates to HTML correctly", () => {
    it("replaced text appears in HTML, rest preserved", () => {
      const html = "<h1>Title.</h1><ul><li><p>Item one.</p></li><li><p>Item two.</p></li></ul>";
      const result = replaceSegmentTextInHtml(html, "Item one.", "Item ONE.");

      expect(stripHtml(result)).toBe("Title. Item ONE. Item two.");
      expect(result).toContain("<h1>");
      expect(result).toContain("<li>");
    });

    it("updated HTML can be diffed back to segments without false changes", () => {
      const segments = [seg(1, "Alpha."), seg(2, "Beta."), seg(3, "Gamma.")];
      const html = "<p>Alpha.</p><p>Beta.</p><p>Gamma.</p>";

      // Simulate: user edits segment 2
      const updatedHtml = replaceSegmentTextInHtml(html, "Beta.", "Delta.");
      const updatedSegments = segments.map((s) => (s.id === 2 ? { ...s, text: "Delta." } : s));

      // Now if someone opens Full Text tab, the diff should show no changes
      const newPlain = stripHtml(updatedHtml);
      const changes = computeSegmentChanges(updatedSegments, newPlain);
      expect(changes).toEqual([]);
    });
  });

  describe("consecutive edits stay consistent", () => {
    it("two sequential edits in different segments", () => {
      let segments = [seg(1, "Foo bar."), seg(2, "Baz qux.")];

      // First edit: change "Foo" to "Hello" via Full Text
      const plain1 = "Hello bar. Baz qux.";
      const changes1 = computeSegmentChanges(segments, plain1);
      expect(changes1).toEqual([{ id: 1, text: "Hello bar." }]);
      segments = segments.map((s) => {
        const c = changes1.find((ch) => ch.id === s.id);
        return c ? { ...s, text: c.text } : s;
      });

      // Second edit: change "qux" to "world" via Full Text
      const plain2 = "Hello bar. Baz world.";
      const changes2 = computeSegmentChanges(segments, plain2);
      expect(changes2).toEqual([{ id: 2, text: "Baz world." }]);
      segments = segments.map((s) => {
        const c = changes2.find((ch) => ch.id === s.id);
        return c ? { ...s, text: c.text } : s;
      });

      expect(segments.map((s) => s.text).join(" ")).toBe("Hello bar. Baz world.");
    });

    it("segment edit then full text edit stays in sync", () => {
      const segments = [seg(1, "Hello."), seg(2, "World.")];
      let html = "<p>Hello.</p><p>World.</p>";

      // Step 1: edit segment 2 via Segments tab
      html = replaceSegmentTextInHtml(html, "World.", "Earth.");
      const updatedSegments = segments.map((s) => (s.id === 2 ? { ...s, text: "Earth." } : s));

      // Step 2: edit segment 1 via Full Text tab
      const editedHtml = html.replace("Hello.", "Hi.");
      const newPlain = stripHtml(editedHtml);
      const changes = computeSegmentChanges(updatedSegments, newPlain);

      expect(changes).toEqual([{ id: 1, text: "Hi." }]);
      expect(newPlain).toBe("Hi. Earth.");
    });
  });
});
