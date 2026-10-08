import { InputTag } from '../types';

/**
 * Comprehensive BehaviorTree.CPP v4 Demonstration Tree XML.
 * Unifies robotics navigation workflows, Modbus PLC communication, and incorporates
 * EVERY built-in BehaviorTree.CPP v4 Control, Decorator, Action, and Condition node.
 */
export const INITIAL_DEMO_XML = `
<root main_tree_to_execute="MainTree">
  <!-- Main High-Level Mission Behavior Tree -->
  <BehaviorTree ID="MainTree">
    <RecoveryNode number_of_retries="5" name="TopLevelRecovery">
      <Sequence name="AutonomousWarehouseMission">

        <!-- 1. Parallel Diagnostics & Pre-Checks -->
        <Parallel success_count="2" failure_count="1" name="SystemDiagnostics">
          <Sequence name="CheckSensorsAndTF">
            <TransformAvailable child="base_link" parent="map" name="CheckMapTF"/>
            <ScriptCondition code="battery_level &gt; 20.0" name="BatteryCheck"/>
            <PassThrough value="STANDBY" output="{system_state}" name="InitState"/>
          </Sequence>
          <ReactiveSequence name="ModbusHandshake">
            <RetryUntilSuccessful num_attempts="3" name="RetryPLCReady">
              <CheckModbus address="m500" expected_value="false" name="CheckPLCReady"/>
            </RetryUntilSuccessful>
            <SetModbusRegister address="m100" value="1" name="SetModbusOnline"/>
            <WriteModbus address="2500" value="true" name="SignalMissionStart"/>
          </ReactiveSequence>
        </Parallel>

        <!-- 2. Mode Configuration & Script Execution -->
        <SetBlackboard output_key="operation_mode" value="AUTONOMOUS" name="SetMode"/>
        <Script code="mission_counter = 1; speed_limit = 1.2" name="InitCounters"/>
        <Switch3 variable="{operation_mode}" case_1="MANUAL" case_2="CALIBRATION" case_3="AUTONOMOUS" name="ModeSelector">
          <Sequence name="ManualModeBranch">
            <AlwaysSuccess name="ManualStandby"/>
          </Sequence>
          <Sequence name="CalibrationBranch">
            <Sleep msec="1000" name="CalibrationDelay"/>
            <AlwaysSuccess name="CalibrationDone"/>
          </Sequence>
          <Sequence name="AutonomousModeBranch">
            <PassThrough value="READY" output="{status_flag}" name="FlagReady"/>
          </Sequence>
        </Switch3>

        <!-- 3. Multi-Waypoint Navigation Mission Loop -->
        <Repeat num_cycles="{num_locations}" name="IterateLocationsLoop">
          <Sequence name="ProcessLocation">
            <LoadAndIterateLocations locations_file="{locations_file}" target_pose="{current_target_pose}" num_locations="{num_locations}" name="FetchNextGoal"/>
            
            <WhileDoElse name="ConditionalPreCheck">
              <Inverter name="InvertObstacleCheck">
                <IsStuck name="CheckIfStuckBeforeStart"/>
              </Inverter>
              <Sequence name="PreFlightPrep">
                <Delay delay_msec="500" name="StabilizationDelay">
                  <AlwaysSuccess name="SensorsSettled"/>
                </Delay>
                <SetBlackboard output_key="nav_status" value="PLANNING" name="MarkPlanning"/>
              </Sequence>
              <Sequence name="HandleBlockedStart">
                <Spin spin_dist="0.785" name="NudgeToUnstick"/>
              </Sequence>
            </WhileDoElse>

            <!-- Navigation Pipeline with Rate & Distance Throttling -->
            <PipelineSequence name="NavigateWithContinuousPlanning">
              <RateController hz="1.0" name="PlanRateThrottle">
                <ComputePathToPose goal="{current_target_pose}" planner_id="GridBased" path="{raw_path}" name="ComputeRawPath"/>
              </RateController>
              <Sequence name="SmoothingAndExecution">
                <SmoothPath unsmoothed_path="{raw_path}" smoothed_path="{smooth_path}" name="FilterPath"/>
                <DistanceController distance="0.5" name="ThrottledController">
                  <FollowPath path="{smooth_path}" controller_id="FollowPath" name="TrackPath"/>
                </DistanceController>
              </Sequence>
            </PipelineSequence>

            <!-- Subtree Invocation with Modbus & Target Pose -->
            <SubTree ID="GoToPoseWithModbus" target_pose="{current_target_pose}" __shared_blackboard="true"/>

            <!-- Multi-Sensor Inspection Branch -->
            <RoundRobin name="InspectionSensorsRoundRobin">
              <Timeout msec="3000" name="LidarScanTimeout">
                <Sequence name="LidarVerification">
                  <Wait wait_duration="0.5" name="WaitLidarSync"/>
                  <GoalReached goal="{current_target_pose}" name="VerifyPosition"/>
                </Sequence>
              </Timeout>
              <ForceSuccess name="IgnoreSecondaryDiagnostics">
                <Sequence name="SonarCheck">
                  <KeepRunningUntilFailure name="MonitorSonarStream">
                    <Inverter name="InvertStuck">
                      <IsStuck name="SonarDetectsObstacle"/>
                    </Inverter>
                  </KeepRunningUntilFailure>
                </Sequence>
              </ForceSuccess>
              <ForceFailure name="StrictCameraCheck">
                <AlwaysFailure name="ForceFailIfCameraOffline"/>
              </ForceFailure>
            </RoundRobin>
          </Sequence>
        </Repeat>

        <!-- 4. Post-Mission Decision & Docking -->
        <IfThenElse name="CheckIfLowBatteryOrFinished">
          <ScriptCondition code="battery_level &lt; 30.0" name="LowBatteryThreshold"/>
          <Sequence name="LowBatteryDocking">
            <SetBlackboard output_key="dock_target" value="FAST_CHARGER" name="SelectFastDock"/>
            <SubTree ID="DockingSubTree" dock_id="FAST_CHARGER" dock_pose="{current_target_pose}"/>
          </Sequence>
          <Sequence name="StandardMissionFinish">
            <Switch2 variable="{dock_target}" case_1="FAST_CHARGER" case_2="HOME_DOCK" name="SelectDock">
              <DockRobot dock_id="fast_charger_dock" name="FastDockAction"/>
              <DockRobot dock_id="home_dock" name="HomeDockAction"/>
            </Switch2>
          </Sequence>
        </IfThenElse>

        <!-- Final Modbus Notification Handshake -->
        <ReactiveFallback name="FinalHandshakeFallback">
          <CheckModbus address="m500" expected_value="true" name="VerifyPLCDone"/>
          <Sequence name="WriteFinalPLCNotice">
            <WriteModbus address="2500" value="false" name="ClearPLCBit"/>
            <WaitAction wait_action_duration="1.0" name="FinalDwellWait"/>
          </Sequence>
        </ReactiveFallback>
      </Sequence>

      <!-- Recovery Actions for TopLevelRecovery -->
      <Sequence name="TopLevelRecoveryActions">
        <ClearEntireCostmap service_name="local_costmap/clear_entirely_local_costmap" name="ClearCostmap"/>
        <Spin spin_dist="1.57" name="RecoverySpin"/>
        <Wait wait_duration="2.0" name="RecoveryWait"/>
      </Sequence>
    </RecoveryNode>
  </BehaviorTree>

  <!-- Reusable SubTree: Pose Navigation with Modbus PLC Safety -->
  <BehaviorTree ID="GoToPoseWithModbus">
    <Sequence name="PoseWithModbusSeq">
      <SetModbusRegister address="m100" value="1" name="SetModbusBusy"/>
      <Fallback name="ActionWithCleanup">
        <Sequence name="HappyPath">
          <WaitAction wait_action_duration="2.0" name="WaitAfterPLCReady"/>
          <RetryUntilSuccessful num_attempts="-1" name="GoToPoseAction">
            <GoToPose target_pose="{target_pose}" name="ExecuteGoToPose"/>
          </RetryUntilSuccessful>
          <NavigateThroughPoses poses="{target_pose}" name="ExecThroughPoses"/>
          <WriteModbus address="2500" value="true" name="SetTaskComplete"/>
          <WaitAction wait_action_duration="2.0" name="DwellAfterComplete"/>
        </Sequence>
        <Sequence name="FailureCleanupPath">
          <WriteModbus address="2010" value="false" name="SetStoppedOnFailure"/>
        </Sequence>
      </Fallback>
      <SetModbusRegister address="m100" value="0" name="SetModbusIdle"/>
    </Sequence>
  </BehaviorTree>

  <!-- Reusable SubTree: Autonomous Docking Supervision -->
  <BehaviorTree ID="DockingSubTree">
    <ParallelAll max_failures="1" name="DockingSupervision">
      <NavigateToPose goal="{dock_pose}" name="ApproachDockPose"/>
      <DockRobot dock_id="{dock_id}" name="PerformPhysicalDock"/>
    </ParallelAll>
  </BehaviorTree>
</root>
`;

/**
 * Standard Blackboard variables and constants for the demonstration tree.
 */
export const DEFAULT_BLACKBOARD_TAGS: InputTag[] = [
  { name: 'goal', value: '{goal}', type: 'PoseStamped', isBlackboard: true },
  { name: 'current_target_pose', value: '{current_target_pose}', type: 'PoseStamped', isBlackboard: true },
  { name: 'target_pose', value: '{target_pose}', type: 'PoseStamped', isBlackboard: true },
  { name: 'dock_pose', value: '{dock_pose}', type: 'PoseStamped', isBlackboard: true },
  { name: 'raw_path', value: '{raw_path}', type: 'Path', isBlackboard: true },
  { name: 'smooth_path', value: '{smooth_path}', type: 'Path', isBlackboard: true },
  { name: 'path', value: '{path}', type: 'Path', isBlackboard: true },
  { name: 'num_locations', value: '4', type: 'int', isBlackboard: true },
  { name: 'locations_file', value: '/opt/maps/waypoints.yaml', type: 'string', isBlackboard: true },
  { name: 'operation_mode', value: 'AUTONOMOUS', type: 'string', isBlackboard: true },
  { name: 'system_state', value: 'STANDBY', type: 'string', isBlackboard: true },
  { name: 'status_flag', value: 'READY', type: 'string', isBlackboard: true },
  { name: 'nav_status', value: 'IDLE', type: 'string', isBlackboard: true },
  { name: 'battery_level', value: '88.5', type: 'double', isBlackboard: true },
  { name: 'mission_counter', value: '1', type: 'int', isBlackboard: true },
  { name: 'dock_target', value: 'HOME_DOCK', type: 'string', isBlackboard: true },
  { name: 'dock_id', value: 'home_dock', type: 'string', isBlackboard: true },
  { name: 'speed_limit', value: '1.2', type: 'double', isBlackboard: true },
  { name: 'GridBased', value: 'GridBased', type: 'string', isBlackboard: false },
  { name: 'FollowPath', value: 'FollowPath', type: 'string', isBlackboard: false },
  { name: 'default_wait', value: '2.0', type: 'double', isBlackboard: false }
];
