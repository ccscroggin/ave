"""Tests for NABRE -> WEB versification and citation parsing.

    python3 scripts/readings/test_versification.py

Needs the cached eng-web USFM and .vrs files (build.py downloads them).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import assemble  # noqa: E402
import citations  # noqa: E402
import versification  # noqa: E402
import web  # noqa: E402

BIBLE = web.load()
VS = versification.Versification(BIBLE)


def m(book, ch, v, letters=""):
    return [(c, x) for _, c, x in VS.map(book, ch, v, letters)[0]]


class Mapping(unittest.TestCase):
    def test_exodus_22(self):
        self.assertEqual(m("EXO", 21, 37), [(22, 1)])
        self.assertEqual(m("EXO", 22, 1), [(22, 2)])
        self.assertEqual(m("EXO", 22, 20), [(22, 21)])
        self.assertEqual(m("EXO", 22, 30), [(22, 31)])

    def test_psalm_superscriptions(self):
        self.assertEqual(m("PSA", 51, 3), [(51, 1)])
        self.assertEqual(m("PSA", 51, 4), [(51, 2)])
        self.assertEqual(m("PSA", 80, 9), [(80, 8)])
        self.assertEqual(m("PSA", 23, 1), [(23, 1)])   # superscription inside verse 1: no shift
        self.assertEqual(m("PSA", 95, 1), [(95, 1)])   # no superscription

    def test_malachi_joel(self):
        self.assertEqual(m("MAL", 3, 19), [(4, 1)])
        self.assertEqual(m("MAL", 3, 24), [(4, 6)])
        self.assertEqual(m("JOL", 3, 1), [(2, 28)])
        self.assertEqual(m("JOL", 3, 5), [(2, 32)])
        self.assertEqual(m("JOL", 4, 1), [(3, 1)])
        self.assertEqual(m("JOL", 4, 21), [(3, 21)])

    def test_other_hebrew_numbering(self):
        self.assertEqual(m("1KI", 5, 1), [(4, 21)])
        self.assertEqual(m("1KI", 5, 15), [(5, 1)])
        self.assertEqual(m("HOS", 2, 16), [(2, 14)])
        self.assertEqual(m("HOS", 12, 1), [(11, 12)])
        self.assertEqual(m("HOS", 14, 2), [(14, 1)])
        self.assertEqual(m("NEH", 3, 33), [(4, 1)])
        self.assertEqual(m("NEH", 4, 1), [(4, 7)])
        self.assertEqual(m("NEH", 10, 1), [(9, 38)])
        self.assertEqual(m("JON", 2, 1), [(1, 17)])
        self.assertEqual(m("JON", 2, 11), [(2, 10)])
        self.assertEqual(m("MIC", 4, 14), [(5, 1)])
        self.assertEqual(m("MIC", 5, 1), [(5, 2)])
        self.assertEqual(m("ZEC", 2, 14), [(2, 10)])
        self.assertEqual(m("SNG", 7, 1), [(6, 13)])
        self.assertEqual(m("ISA", 8, 23), [(9, 1)])
        self.assertEqual(m("ISA", 9, 1), [(9, 2)])
        self.assertEqual(m("ISA", 64, 2), [(64, 3)])

    def test_overrides(self):
        self.assertEqual(m("ISA", 63, 19, "b"), [(64, 1)])
        self.assertEqual(m("ISA", 63, 19), [(63, 19), (64, 1)])
        self.assertEqual(m("ROM", 16, 25), [(14, 24)])
        self.assertEqual(m("2CO", 13, 13), [(13, 14)])
        self.assertEqual(m("3JN", 1, 15), [(1, 14)])
        self.assertEqual(m("REV", 12, 18), [(13, 1)])
        self.assertEqual(m("DAN", 3, 98), [(4, 1)])
        self.assertEqual(m("EST", "C", 12), [(4, 29)])

    def test_daniel_greek(self):
        # NABRE and eng-web's Greek Daniel share the Greek numbering of chapter 3
        self.assertEqual(m("DAN", 3, 52), [(3, 52)])
        self.assertTrue(BIBLE["DAN"][3][52].lstrip("“").startswith("Blessed are you, O Lord"))
        self.assertTrue(BIBLE["DAN"][3][91].startswith("Then Nebuchadnezzar the king was astonished"))
        self.assertEqual(m("DAN", 6, 12), [(6, 11)])
        self.assertEqual(m("DAN", 13, 1), [(13, 1)])

    def test_esther_addition_c(self):
        self.assertIn("queen Esther took refuge in the Lord", BIBLE["EST"][4][29])
        self.assertIn("you alone are our king", BIBLE["EST"][4][31])

    def test_mapped_verses_exist(self):
        for ref in [("EXO", 22, 20), ("MAL", 3, 24), ("JOL", 4, 21), ("1KI", 5, 32), ("NEH", 10, 40),
                    ("HOS", 14, 10), ("ZEC", 2, 17), ("MIC", 5, 14), ("SNG", 7, 14), ("JON", 2, 11)]:
            for b, c, v in VS.map(*ref)[0]:
                self.assertTrue(BIBLE[b][c].get(v), ref)


class Resolve(unittest.TestCase):
    def test_exodus_22_20_26(self):
        r = assemble.resolve("Exodus 22:20-26", BIBLE, VS)
        self.assertEqual([(c, v) for c, v, *_ in r["verses"]], [(22, x) for x in range(21, 28)])
        self.assertTrue(r["verses"][0][2].lstrip("“").startswith("You shall not wrong"))
        self.assertFalse(r["missing"])

    def test_cross_chapter_and_letters(self):
        r = assemble.resolve("Galatians 4:22-24, 26-27, 31–5:1", BIBLE, VS)
        self.assertEqual([(c, v) for c, v, *_ in r["verses"]],
                         [(4, 22), (4, 23), (4, 24), (4, 26), (4, 27), (4, 31), (5, 1)])
        r = assemble.resolve("Isaiah 63:16b-17, 19b; 64:2-7", BIBLE, VS)
        self.assertEqual([(c, v) for c, v, *_ in r["verses"]],
                         [(63, 16), (63, 17), (64, 1), (64, 3), (64, 4), (64, 5), (64, 6), (64, 7), (64, 8)])

    def test_jonah_cross_chapter_mapping(self):
        r = assemble.resolve("Jonah 1:1–2:2, 11", BIBLE, VS)
        refs = [(c, v) for c, v, *_ in r["verses"]]
        self.assertEqual(refs[-3:], [(1, 17), (2, 1), (2, 10)])
        self.assertEqual(len(refs), 19)

    def test_nabre_omitted_verse_skipped(self):
        r = assemble.resolve("Luke 17:26-37", BIBLE, VS)
        self.assertNotIn(36, [v for _, v, *_ in r["verses"]])
        self.assertEqual(r["skipped_nabre_omitted"], ["LUK 17:36"])

    def test_psalm_with_superscription_verse(self):
        r = assemble.resolve("Psalm 51:3-4, 5-6ab, 12-13, 14 and 17", BIBLE, VS)
        self.assertEqual([(c, v) for c, v, *_ in r["verses"]][:2], [(51, 1), (51, 2)])

    def test_nabre_labels(self):
        r = assemble.resolve("Exodus 22:20-26", BIBLE, VS)
        self.assertEqual([x[3] for x in r["verses"]][:2], ["22:20", "22:21"])
        r = assemble.resolve("Romans 16:25-27", BIBLE, VS)
        self.assertEqual([(x[0], x[1], x[3]) for x in r["verses"]],
                         [(14, 24, "16:25"), (14, 25, "16:26"), (14, 26, "16:27")])
        r = assemble.resolve("3 John 13-15", BIBLE, VS)
        self.assertEqual([(x[1], x[3]) for x in r["verses"]], [(13, "1:13"), (14, "1:14-15")])
        r = assemble.resolve("Isaiah 61:1-2a, 10-11", BIBLE, VS)
        self.assertEqual(r["partials"], ["61:2a"])

    def test_clean(self):
        self.assertEqual(citations.clean("Sirach 51:12 cd-20")[0], "Sirach 51:12cd-20")
        self.assertEqual(citations.clean("137:1-2, 3", "Responsorial Psalm")[0], "Psalm 137:1-2, 3")
        self.assertEqual(citations.clean("1 Samuel 2:1, 4-5", "Responsorial Psalm")[0], "1 Samuel 2:1, 4-5")
        self.assertEqual(citations.clean("Psalm 37:3-4, 18 and 23")[0], "Psalm 37:3-4, 18 and 23")
        self.assertEqual(citations.clean("Revelation 11:19A; 12:1-6A")[0], "Revelation 11:19a; 12:1-6a")
        self.assertEqual(citations.clean("Sirarch 5:1-8")[0], "Sirach 5:1-8")

    def test_alternatives(self):
        self.assertEqual(citations.split_alternatives("Mark 14:1—15:47 or 15:1-39"),
                         ["Mark 14:1—15:47", "Mark 15:1-39"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
