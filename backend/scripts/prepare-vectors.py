#!/usr/bin/env python3
"""
Trim GloVe vectors to the top N alphabetic words, L2-normalize them and write:
  data/words.json    JSON array of words (row order)
  data/vectors.bin   float32 little-endian, N x DIM, row-major
  data/meta.json     { "dim": DIM, "count": N }

Usage:
  python3 scripts/prepare-vectors.py <glove.txt|glove.gz> [--top 50000]

Accepted inputs: plain GloVe text ("word v1 v2 ...") or the gensim-data
word2vec text format (first line "<count> <dim>"), optionally gzipped.
Vectors are centered and the top principal components are removed (see below).
Files are ordered by frequency in the source, so "top N" = first N valid lines.
"""
import argparse, gzip, json, re, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--top", type=int, default=50000)
ap.add_argument("--out", default="data")
ap.add_argument("--pcs", type=int, default=2,
                help="number of dominant principal components to remove")
args = ap.parse_args()

opener = gzip.open if args.src.endswith(".gz") else open
word_re = re.compile(r"^[a-z]{2,}$|^[ai]$")
words, rows, dim = [], [], None

with opener(args.src, "rt", encoding="utf-8") as fh:
    for line in fh:
        parts = line.rstrip().split(" ")
        if dim is None:
            if len(parts) == 2 and parts[0].isdigit():  # word2vec header
                continue
            dim = len(parts) - 1
        if len(parts) != dim + 1:
            continue
        word = parts[0]
        if not word_re.match(word):
            continue
        words.append(word)
        rows.append(np.asarray(parts[1:], dtype=np.float32))
        if len(words) >= args.top:
            break

mat = np.vstack(rows)

# "All-but-the-top" post-processing (Mu & Viswanath, 2018): center the vectors
# and remove the dominant principal components. Raw GloVe vectors of frequent
# words (since, part, new, year...) are similar to almost everything; without
# this step they would be colored on nearly every guess.
mat -= mat.mean(axis=0, keepdims=True)
if args.pcs > 0:
    _, _, vt = np.linalg.svd(mat, full_matrices=False)
    top = vt[: args.pcs]
    mat -= (mat @ top.T) @ top
mat /= np.linalg.norm(mat, axis=1, keepdims=True) + 1e-12

import os
os.makedirs(args.out, exist_ok=True)
with open(f"{args.out}/words.json", "w") as f:
    json.dump(words, f)
mat.astype("<f4").tofile(f"{args.out}/vectors.bin")
with open(f"{args.out}/meta.json", "w") as f:
    json.dump({"dim": int(dim), "count": len(words)}, f)
print(f"wrote {len(words)} words x {dim} dims "
      f"({mat.nbytes / 1e6:.1f} MB) to {args.out}/", file=sys.stderr)