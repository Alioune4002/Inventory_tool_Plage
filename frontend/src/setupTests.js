import '@testing-library/jest-dom/vitest';

class IntersectionObserverMock {
  constructor() {
    this.targets = new Set()
  }

  observe(target) {
    this.targets.add(target)
  }

  unobserve(target) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
  }
}

if (typeof window.IntersectionObserver === 'undefined') {
  window.IntersectionObserver = IntersectionObserverMock
}
