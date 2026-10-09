import { INITIAL_DEMO_XML } from './data';

export interface TreeTemplate {
  id: string;
  title: string;
  category: 'Demo' | 'Basic' | 'Robotics' | 'Diagnostics' | 'Industrial';
  description: string;
  badge: string;
  nodeCountEstimate: number;
  iconType: 'robot' | 'plus' | 'shield' | 'pipeline' | 'arm';
  xmlContent: string;
  isDefaultDemo?: boolean;
}

export const BLANK_TREE_XML = `
<root main_tree_to_execute="MainTree">
  <BehaviorTree ID="MainTree">
    <Sequence name="RootSequence">
      <AlwaysSuccess name="Task_1"/>
      <AlwaysSuccess name="Task_2"/>
    </Sequence>
  </BehaviorTree>
</root>
`.trim();

export const REACTIVE_PATROL_XML = `
<root main_tree_to_execute="PatrolMission">
  <BehaviorTree ID="PatrolMission">
    <ReactiveFallback name="SafetyGuardFallback">
      <!-- 1. Emergency & Low Battery Safeguard -->
      <Sequence name="BatterySafetyCheck">
        <ScriptCondition code="battery_level &lt; 20.0" name="IsBatteryLow"/>
        <AlwaysSuccess name="NavigateToCharger"/>
        <AlwaysSuccess name="ChargeBattery"/>
      </Sequence>

      <!-- 2. Reactive Patrol Loop -->
      <ReactiveSequence name="ActivePatrolLoop">
        <Inverter name="ObstacleClear">
          <ScriptCondition code="obstacle_detected == true" name="CheckObstacle"/>
        </Inverter>
        <Sequence name="WaypointPatrol">
          <AlwaysSuccess name="MoveToPointA"/>
          <Sleep msec="1500" name="InspectAreaA"/>
          <AlwaysSuccess name="MoveToPointB"/>
          <Sleep msec="1500" name="InspectAreaB"/>
        </Sequence>
      </ReactiveSequence>
    </ReactiveFallback>
  </BehaviorTree>
</root>
`.trim();

export const PARALLEL_DIAGNOSTICS_XML = `
<root main_tree_to_execute="DiagnosticsSupervisor">
  <BehaviorTree ID="DiagnosticsSupervisor">
    <ParallelAll max_failures="1" name="SystemHealthMonitor">
      <Sequence name="LidarHeartbeat">
        <AlwaysSuccess name="CheckLidarStream"/>
        <AlwaysSuccess name="VerifyPointcloudDensity"/>
      </Sequence>
      <Sequence name="CameraStreamCheck">
        <AlwaysSuccess name="CheckRgbStream"/>
        <AlwaysSuccess name="VerifyDepthBuffer"/>
      </Sequence>
      <Sequence name="ImuAndOdometry">
        <AlwaysSuccess name="CheckImuDrift"/>
        <AlwaysSuccess name="VerifyWheelEncoders"/>
      </Sequence>
    </ParallelAll>
  </BehaviorTree>
</root>
`.trim();

export const PICK_AND_PLACE_XML = `
<root main_tree_to_execute="PickAndPlaceRoutine">
  <BehaviorTree ID="PickAndPlaceRoutine">
    <Sequence name="ManipulatorExecution">
      <Fallback name="LocateTargetPart">
        <AlwaysSuccess name="DetectPartFromCamera"/>
        <Sequence name="RepositionCameraArm">
          <AlwaysSuccess name="MoveArmToOverview"/>
          <AlwaysSuccess name="RetryPartDetection"/>
        </Sequence>
      </Fallback>
      <Sequence name="GraspExecution">
        <AlwaysSuccess name="MoveToPreGraspPose"/>
        <AlwaysSuccess name="OpenGripper"/>
        <AlwaysSuccess name="ApproachGraspPose"/>
        <AlwaysSuccess name="CloseGripperWithForceControl"/>
      </Sequence>
      <Sequence name="TransportAndRelease">
        <AlwaysSuccess name="LiftPart"/>
        <AlwaysSuccess name="MoveToTargetBin"/>
        <AlwaysSuccess name="OpenGripper"/>
        <AlwaysSuccess name="ReturnHomePose"/>
      </Sequence>
    </Sequence>
  </BehaviorTree>
</root>
`.trim();

export const TREE_TEMPLATES: TreeTemplate[] = [
  {
    id: 'default-warehouse',
    title: 'Autonomous Warehouse Mission (Default Demo)',
    category: 'Demo',
    description: 'Full-featured warehouse robot architecture with BT.CPP v4 Recovery, Parallel, ReactiveSequence, and Switch3 nodes.',
    badge: 'BT.CPP v4 Demo',
    nodeCountEstimate: 28,
    iconType: 'robot',
    xmlContent: INITIAL_DEMO_XML.trim(),
    isDefaultDemo: true
  },
  {
    id: 'blank-tree',
    title: 'Blank Behavior Tree',
    category: 'Basic',
    description: 'Clean slate template featuring a root Sequence node and sample action tasks.',
    badge: 'Blank Canvas',
    nodeCountEstimate: 3,
    iconType: 'plus',
    xmlContent: BLANK_TREE_XML
  },
  {
    id: 'reactive-patrol',
    title: 'Reactive Patrol & Safety Guard',
    category: 'Robotics',
    description: 'Industrial patrol mission with battery monitoring, emergency stop fallback, and reactive waypoint navigation.',
    badge: 'Reactive Safety',
    nodeCountEstimate: 12,
    iconType: 'shield',
    xmlContent: REACTIVE_PATROL_XML
  },
  {
    id: 'parallel-diagnostics',
    title: 'Parallel Sensor Diagnostics',
    category: 'Diagnostics',
    description: 'Concurrent diagnostics pipeline checking Lidar, RGB-D camera, and IMU telemetry with ParallelAll.',
    badge: 'Parallel Monitor',
    nodeCountEstimate: 8,
    iconType: 'pipeline',
    xmlContent: PARALLEL_DIAGNOSTICS_XML
  },
  {
    id: 'pick-and-place',
    title: 'Industrial Pick & Place Arm',
    category: 'Industrial',
    description: 'Manipulator workflow coordinating target detection, approach, gripper force grasping, and bin placement.',
    badge: 'Manipulation',
    nodeCountEstimate: 14,
    iconType: 'arm',
    xmlContent: PICK_AND_PLACE_XML
  }
];
