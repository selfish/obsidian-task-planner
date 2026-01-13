import * as React from "react";
import { TaskPlannerEvent } from "../events/TaskPlannerEvent";
import { Logger } from "../types/logger";

export type Sound = "checked";

export interface SoundPlayerDeps {
  logger: Logger;
}

export interface SoundPlayerProps {
  playSound: TaskPlannerEvent<Sound>;
  deps: SoundPlayerDeps;
}

export function SoundPlayer({ playSound, deps }: SoundPlayerProps): React.ReactElement {
  const id = React.useMemo(() => `audio-${Math.round(Math.random() * 1000000000)}`, []);

  React.useEffect(() => {
    playSound.listen(async (sound: Sound) => {
      deps.logger.debug(`Playing ${sound}`);
      if (sound === "checked") {
        const checkedAudio = document.getElementById(id) as HTMLAudioElement;
        if (checkedAudio) {
          checkedAudio.play();
        }
      } else {
        deps.logger.error(`Unknown sound: ${sound}`);
      }
    });
  }, [playSound, deps.logger, id]);

  return (
    <>
      <audio id={id}></audio>
    </>
  );
}
