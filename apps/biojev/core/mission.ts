/**
 * `runMission` will be the long-running Effect program that repeatedly:
 * 1. reads canonical lifecycle state from BioLab;
 * 2. calls pure `nextAction`;
 * 3. runs exactly one legal unit;
 * 4. repeats until paused or operationally blocked.
 *
 * It is intentionally not implemented before BioLab lifecycle stores exist.
 */
export {}
