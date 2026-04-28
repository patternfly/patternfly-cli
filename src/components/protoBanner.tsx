import * as React from "react";
import { Banner, Bullseye } from "@patternfly/react-core";

const ProtoBanner: React.FC = () => {
  return (
    <Banner isSticky>
      <Bullseye>
        <strong>This application is a design prototype</strong>
      </Bullseye>
    </Banner>
  );
};

export default ProtoBanner;
