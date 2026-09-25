import crypto from 'crypto';

/**
 * Computes SHA-256 hash of a string or buffer
 */
export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Combines and hashes two child hashes deterministically
 */
export function hashPair(left, right) {
  if (!right) return left;
  return sha256(left + right);
}

/**
 * Merkle Tree Implementation for Audit Trail Batching
 */
export class MerkleTree {
  constructor(leaves) {
    if (!leaves || leaves.length === 0) {
      throw new Error('Cannot construct Merkle tree with empty leaves');
    }
    this.leaves = leaves.map((l) => (typeof l === 'string' ? l : sha256(JSON.stringify(l))));
    this.layers = [this.leaves];
    this.buildTree();
  }

  buildTree() {
    let currentLayer = this.leaves;
    while (currentLayer.length > 1) {
      const nextLayer = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left; // duplicate odd leaf
        nextLayer.push(hashPair(left, right));
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  getRoot() {
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Generates Merkle inclusion proof for a given leaf index
   */
  getProof(leafIndex) {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds`);
    }

    const proof = [];
    let currentIndex = leafIndex;

    for (let layerIndex = 0; layerIndex < this.layers.length - 1; layerIndex++) {
      const layer = this.layers[layerIndex];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < layer.length) {
        proof.push({
          position: isRightNode ? 'left' : 'right',
          hash: layer[siblingIndex]
        });
      } else {
        // Sibling was duplicate of self
        proof.push({
          position: 'right',
          hash: layer[currentIndex]
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  /**
   * Statically verifies a Merkle inclusion proof against a root
   */
  static verifyProof(leafHash, proof, expectedRoot) {
    let computedHash = leafHash;

    for (const step of proof) {
      if (step.position === 'left') {
        computedHash = hashPair(step.hash, computedHash);
      } else {
        computedHash = hashPair(computedHash, step.hash);
      }
    }

    return computedHash === expectedRoot;
  }
}
