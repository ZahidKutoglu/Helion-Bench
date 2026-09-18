import { SYNTHETIC_DISCLAIMER as N } from "./constants";

export const CORPUS = [
  {
    id: "SYN-REQ-TS-001",
    title: "Timing Synchronization System Requirements HWL-TS-REQ-12",
    document_type: "requirement",
    component: "Timing Synchronization",
    version: "B-103",
    source: "synthetic/requirements/hwl-ts-req-12.md",
    tags: ["timing", "pps", "ptp"],
    content: `# Timing Synchronization System Requirements

${N}

## Scope
The Helion Wireless Lab timing plane distributes a 10 MHz reference and a 1 PPS edge to the sensing pipeline, data acquisition cards, and the communications interface. All requirements below are synthetic lab rules for verification engineers.

## TS-R12.1 Clock offset
Under chamber temperatures from 15 C to 40 C, the recovered PTP clock shall remain within 250 ns of the lab grandmaster. Offset is measured by test TS-4410.

## TS-R12.2 Holdover
If PPS is lost for less than 8 seconds, holdover shall keep offset under 400 ns. Beyond 8 seconds the verification framework shall flag TIMING_HOLDOVER_EXCEEDED.

## TS-R12.3 Cable plant
The PPS path uses a dedicated 50 ohm coaxial run labeled PPS-A. Mixing PPS-A with the 10 MHz run (REF-A) is a known configuration error in this fictional lab.

## Notes
Build B-103 is the last build that closed TS-4410 at 118 ns mean offset. Later builds must not silently relax the 250 ns limit.
`,
  },
  {
    id: "SYN-TSPEC-TS-B104",
    title: "Test specification TS-4410 Timing offset, build B-104",
    document_type: "test_specification",
    component: "Timing Synchronization",
    version: "B-104",
    source: "synthetic/tests/ts-4410-b104.md",
    tags: ["TS-4410", "B-104"],
    content: `# TS-4410 Timing offset test specification

${N}

## Purpose
Measure mean and peak PTP offset versus the Helion grandmaster during a 20 minute soak at 25 C and a 20 minute soak at 42 C.

## Pass criteria
- Mean offset <= 250 ns at 25 C
- Peak offset <= 400 ns at 42 C
- No TIMING_HOLDOVER_EXCEEDED events

## Procedure
1. Confirm PPS-A is connected to SYNC-IN0.
2. Confirm PTP domain 24 on the timing NIC.
3. Arm the verification framework recorder.
4. Execute soak profiles THERM-25 and THERM-42.

## B-104 notes
The verification framework in B-104 still uses the 250 ns mean limit. Do not treat a 310 ns mean as a pass. Build notes SYN-BUILD-B104 record a PPS cable swap that violates step 1.
`,
  },
  {
    id: "SYN-FAIL-TS-B104",
    title: "Failure report TS-4410 build B-104 timing synchronization",
    document_type: "failure_report",
    component: "Timing Synchronization",
    version: "B-104",
    source: "synthetic/failures/ts-4410-b104.md",
    tags: ["failure", "timing drift", "B-104"],
    content: `# Failure report: TS-4410 in build B-104

${N}

## Result
FAILED. Timing synchronization test TS-4410 did not meet HWL-TS-REQ-12.

## Observed
- Mean clock offset at 25 C: 312 ns (limit 250 ns)
- Peak offset at 42 C: 641 ns (limit 400 ns)
- TIMING_HOLDOVER_EXCEEDED asserted twice when the chamber compressor cycled

## Immediate evidence
Lab photos show the 1 PPS jumper on REF-A instead of PPS-A. The timing NIC remained on PTP domain 18 leftover from a communications interface experiment. Domain 18 is not the lab grandmaster domain (24).

## Not confirmed
A firmware regression in the PTP stack is possible but is not established by this report. The same binary passed TS-4410 on B-103 with PPS-A and domain 24.

## Follow-up
Restore PPS-A, set PTP domain 24, rerun TS-4410. See troubleshooting guide SYN-TROUBLE-TS-001 and build notes SYN-BUILD-B104.
`,
  },
  {
    id: "SYN-TROUBLE-TS-001",
    title: "Troubleshooting guide: timing drift and PPS cabling",
    document_type: "troubleshooting_guide",
    component: "Timing Synchronization",
    version: "B-104",
    source: "synthetic/guides/timing-drift.md",
    tags: ["troubleshooting", "PPS"],
    content: `# Troubleshooting timing drift

${N}

## Symptom
TS-4410 fails with clock offset above 250 ns, sometimes only above 40 C.

## Checks
1. PPS-A must terminate on SYNC-IN0. If the cable is on REF-A, mean offset typically jumps to 280-350 ns in this lab.
2. PTP domain must be 24. Domain 18 produces a plausible-looking clock that still fails TS-4410.
3. Chamber temperature above 40 C increases oscillator wander. Holdover then trips if PPS edges are also dirty.

## What not to conclude
Do not call a cabling error a silicon defect. Do not claim a root cause without TS-4410 logs and a photograph of PPS-A.

## Related failures
Build B-104 combined the PPS-A swap with domain 18. Packet loss on IF-2 is a separate communications issue; do not merge those tickets.
`,
  },
  {
    id: "SYN-BUILD-B104",
    title: "Software build notes B-104",
    document_type: "build_notes",
    component: "Verification Framework",
    version: "B-104",
    source: "synthetic/builds/b-104.md",
    tags: ["B-104", "release"],
    content: `# Build B-104 notes

${N}

## Contents
- Timing stack binary unchanged from B-103
- Communications interface driver 2.4.1
- Verification framework recorder 1.9.0 (same TS-4410 limits)

## Lab configuration captured at build intake
A bench rework moved a coaxial jumper. The intake photo labeled "temporary 10 MHz tee" shows PPS sitting on REF-A. PTP domain on NIC-T was 18.

## Known test impact
TS-4410 is expected to fail until PPS-A and domain 24 are restored. Do not waive the test. Sensing pipeline SNR tests are independent.

## Next build
B-105 restores cabling and domain. IF-2 packet loss is still open.
`,
  },
  {
    id: "SYN-FAIL-SP-SNR",
    title: "Failure report SNR degradation on sensing pipeline",
    document_type: "failure_report",
    component: "Sensing Pipeline",
    version: "B-104",
    source: "synthetic/failures/snr-b104.md",
    tags: ["SNR", "sensing"],
    content: `# Failure report: sensing pipeline SNR

${N}

## Result
FAILED. Front-end SNR dropped from 41 dB (B-103 baseline) to 33 dB on channel SP-1.

## Setup
CW tone at 2.45 GHz, -40 dBm at the synthetic antenna port. Signal processing path used profile SP-CAL-2.

## Observations
Gain table index 4 was applied instead of index 2. Index 4 is the interferer-suppression profile and raises the noise floor. The sensing pipeline log prints \`GAIN_PROFILE=4\`.

## Hypotheses recorded by the shift engineer
A possible cause is a leftover calibration flag from the communications interface campaign. This is not confirmed as a software defect in signal processing.

## Related
See troubleshooting SYN-TROUBLE-SP-001. Timing failures in B-104 are a different subsystem.
`,
  },
  {
    id: "SYN-TROUBLE-SP-001",
    title: "Troubleshooting guide: SNR and front-end gain profiles",
    document_type: "troubleshooting_guide",
    component: "Signal Processing",
    version: "B-104",
    source: "synthetic/guides/snr-gain.md",
    tags: ["SNR", "gain"],
    content: `# Troubleshooting SNR degradation

${N}

## Symptom
Signal-to-noise ratio on the sensing pipeline falls by more than 5 dB versus the B-103 baseline.

## Checks
1. Confirm GAIN_PROFILE=2 for SP-CAL-2. Profile 4 is for interferer work and will look like noise-figure damage.
2. Confirm the synthetic tone power is -40 dBm. A 10 dB pad left in the path also drops SNR.
3. Inspect SP-1 SMA torque. Loose RF connectors in this lab have produced 2-3 dB hits, not 8 dB.

## Signal processing note
The FFT chain in B-104 is unchanged. Do not replace the DSP FPGA image for a gain-table mismatch.
`,
  },
  {
    id: "SYN-FAIL-CI-PKT",
    title: "Failure report packet loss on communications interface IF-2",
    document_type: "failure_report",
    component: "Communications Interface",
    version: "B-104",
    source: "synthetic/failures/if2-packet-loss.md",
    tags: ["packet loss", "IF-2"],
    content: `# Failure report: IF-2 packet loss

${N}

## Result
FAILED. Communications interface IF-2 showed 1.8% packet loss under load profile CI-BURST-3 after build B-104. Limit is 0.1%.

## Trace
Driver 2.4.1 logs \`IF2_CRC_ERR\` bursts aligned with DMA completion. IF-1 on the same card stayed under 0.02%.

## Evidence
Release notes 1.4.0 mention a ring-buffer size change for IF-2 only. Timing synchronization failures in the same build used different hardware (NIC-T, PPS-A) and are not a packet-loss explanation.

## Open question
Whether B-105 driver 2.4.2 clears IF-2 is not answered in this report.
`,
  },
  {
    id: "SYN-REL-1-4-0",
    title: "Release notes Helion comms interface 1.4.0",
    document_type: "release_notes",
    component: "Communications Interface",
    version: "B-104",
    source: "synthetic/releases/comms-1-4-0.md",
    tags: ["release", "IF-2"],
    content: `# Communications interface 1.4.0

${N}

## Changes
- Driver 2.4.1 ships in build B-104
- IF-2 TX ring reduced from 4096 to 2048 descriptors to save SRAM
- IF-1 unchanged

## Risks
The smaller IF-2 ring can drop frames during CI-BURST-3. Packet loss on IF-2 after B-104 should be investigated against this change before blaming the RF path.

## Timing
This release does not change PTP or PPS handling.
`,
  },
  {
    id: "SYN-REQ-DAQ-001",
    title: "Data acquisition latency requirements HWL-DAQ-REQ-04",
    document_type: "requirement",
    component: "Data Acquisition",
    version: "B-103",
    source: "synthetic/requirements/daq-req-04.md",
    tags: ["latency", "DAQ"],
    content: `# Data acquisition latency requirements

${N}

## DAQ-R04.1
End-to-end sample latency from analog capture to verification recorder shall stay under 2.0 ms at 25 C.

## DAQ-R04.2
In the thermal chamber at 42 C, latency shall stay under 2.5 ms. A rise with temperature is expected; a jump beyond 3.0 ms is a failure.

## Dependencies
DAQ cards share the timing plane. If TS-4410 is failing, latency numbers remain valid measurements but should be annotated as "timing plane degraded".
`,
  },
  {
    id: "SYN-FAIL-DAQ-LAT",
    title: "Failure report data acquisition latency in thermal chamber",
    document_type: "failure_report",
    component: "Data Acquisition",
    version: "B-104",
    source: "synthetic/failures/daq-latency.md",
    tags: ["latency", "thermal"],
    content: `# Failure report: DAQ latency at 42 C

${N}

## Result
FAILED DAQ-R04.2. Mean latency in the thermal chamber was 3.4 ms (limit 2.5 ms). At 25 C the same build measured 1.7 ms (pass).

## Correlation
Latency spikes lined up with TIMING_HOLDOVER_EXCEEDED from the B-104 timing failure. When PPS-A was restored in a trial rerun, chamber latency fell to 2.2 ms.

## Interpretation
The thermal latency increase in B-104 is explained by a degraded timing plane, not by a new DAQ FPGA image. The DAQ bitstream is identical to B-103.

## Remaining uncertainty
A small temperature coefficient still exists (2.2 ms vs 1.7 ms). That remainder is within DAQ-R04.2 after the timing restore.
`,
  },
  {
    id: "SYN-VF-NOTES-001",
    title: "Verification framework recorder notes 1.9.0",
    document_type: "component_documentation",
    component: "Verification Framework",
    version: "B-104",
    source: "synthetic/components/vf-recorder.md",
    tags: ["framework", "TS-4410"],
    content: `# Verification framework 1.9.0

${N}

## Recorders
The framework stores TS-4410 offset traces, CI packet counters, DAQ latency histograms, and sensing SNR.

## Thresholds in B-104
TS-4410 mean offset threshold remains 250 ns. A request to relax it to 350 ns was rejected. Failures in build B-104 must stay visible.

## How to read a fail
A red TS-4410 with \`OFFSET_MEAN_NS=312\` means the timing requirement was not met. Combine with build notes before filing a silicon ticket.
`,
  },
  {
    id: "SYN-COMP-DAQ-001",
    title: "Data acquisition card HWL-DAQ-7 component documentation",
    document_type: "component_documentation",
    component: "Data Acquisition",
    version: "B-103",
    source: "synthetic/components/hwl-daq-7.md",
    tags: ["DAQ"],
    content: `# HWL-DAQ-7

${N}

Synthetic 8-channel capture card used in the Helion bench. Sample clock is recovered from the timing plane. Intermittent interface failures on the PCIe endpoint have been seen after unplanned power cycles; the recovery is a full slot reset, not a driver reload.
`,
  },
  {
    id: "SYN-INV-HIST-001",
    title: "Historical investigation: B-101 intermittent IF-1 CRC",
    document_type: "investigation_record",
    component: "Communications Interface",
    version: "B-101",
    source: "synthetic/investigations/b101-if1.md",
    tags: ["historical", "IF-1"],
    content: `# Historical investigation B-101

${N}

IF-1 produced intermittent CRC errors. Root cause in this fictional record was a cracked SMA on the bench jumper, confirmed by wiggle test. Not related to B-104 IF-2 ring-buffer changes.
`,
  },
];
