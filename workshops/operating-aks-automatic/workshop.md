---
published: true # Optional. Set to true to publish the workshop (default: false)
type: workshop # Required.
title: Streamline operations and developer onboarding with AKS Automatic # Required. Full title of the workshop
short_title: Operating AKS Automatic # Optional. Short title displayed in the header
description: Are you looking for ways to automate many administrative tasks in Kubernetes and make it easier for development teams to deploy their apps while maintaining security and compliance? Azure Kubernetes Service (AKS) Automatic is a new mode of operation for AKS that simplifies cluster management, reduces manual tasks, and builds in enterprise-grade best practices and policy enforcement. This session is perfect for platform operators and DevOps engineers looking to get started with AKS Automatic. # Required.
level: beginner # Required. Can be 'beginner', 'intermediate' or 'advanced'
authors: # Required. You can add as many authors as needed
  - "Paul Yu"
contacts: # Required. Must match the number of authors
  - "@pauldotyu"
duration_minutes: 75 # Required. Estimated duration in minutes
tags: kubernetes, azure, aks # Required. Tags for filtering and searching
wt_id: WT.mc_id=containers-153036-pauyu
---

## Overview

AKS Automatic is a new mode of operation for Azure Kubernetes Service (AKS) that simplifies cluster management, reduces manual tasks, and builds in enterprise-grade best practices and policy enforcement. This lab is meant to be a hands-on experience for Azure administrators and DevOps engineers looking to get started with AKS Automatic. You will learn how to automate many administrative tasks in Kubernetes and make it easier for development teams to deploy their apps while maintaining security and compliance.

Many of the features you will be working with in this workshop are in preview and may not be recommended for production workloads. However, the AKS engineering team is working hard to bring these features to general availability and will be great learning opportunities for you to understand options to support developers and streamline operations. This is not platform engineering, but it is a step in the right direction to automate many of the tasks that platform engineers do today.

### Objectives

By the end of this lab you will be able to:

- Administer user access to the AKS cluster
- Ensure security best practices with Azure Policy and Deployment Safeguards
- Sync configurations to the cluster with Azure App Configuration Provider for Kubernetes
- Leverage AKS Service Connector for passwordless integration with Azure services
- Appropriately scale workloads across nodes with AKS Node Autoprovision
- Review workload scheduling best practices
- Troubleshoot workload failures with monitoring tools and Microsoft Copilot for Azure

### Prerequisites

The lab environment has been pre-configured for you with the following Azure resources:

- [AKS Automatic](https://learn.microsoft.com/azure/aks/intro-aks-automatic) cluster with monitoring enabled
- [Azure Container Registry](https://learn.microsoft.com/azure/container-registry/container-registry-intro)
- [Azure Log Analytics Workspace](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-workspace-overview)
- [Azure Managed Prometheus](https://learn.microsoft.com/azure/azure-monitor/essentials/prometheus-metrics-overview)
- [Azure Managed Grafana](https://learn.microsoft.com/azure/managed-grafana/overview)

> [!HELP]
> The Bicep template used to deploy the lab environment can be found [here](https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/aks.bicep)

You will also need the following tools:

- [Visual Studio Code](https://code.visualstudio.com/)
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli)
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
- [kubelogin](https://learn.microsoft.com/azure/aks/kubelogin-authentication)
- [Helm](https://helm.sh/docs/intro/install/)

> [!NOTE]
> All command-line instructions in this lab should be executed in a Bash shell. If you are using Windows, you can use the Windows Subsystem for Linux (WSL) or Azure Cloud Shell.

Before you get started, open a Bash shell and log in to your Azure subscription with the following command:

```bash
az login --use-device-code
```

You will be prompted to open a browser and log in with your Azure credentials. Copy the code that is displayed and paste it in the browser to authenticate.

You will also need to install the **aks-preview** and **k8s-extension** extensions to leverage preview features in AKS and install AKS extensions.

```bash
az extension add --name aks-preview
az extension add --name k8s-extension
```

Finally set the default location for resources that you will create in this lab using Azure CLI.

```bash
az configure --defaults location=$(az group show -n myresourcegroup --query location -o tsv)
```

You are now ready to get started with the lab.

===

## Security

Security above all else! The AKS Automatic cluster is configured with Azure Role-Based Access Control (RBAC) authentication and authorization, Azure Policy, and Deployment Safeguards enabled out of the box. This section aims to get AKS operators comfortable with administering user access to the AKS cluster, ensuring security best practices with Azure Policy and Deployment Safeguards.

### Granting permissions to the AKS cluster

With Azure RBAC enabled on the AKS cluster granting users access to the cluster is as simple as assigning roles to users, groups, and/or service principals. Users will need to run the normal **az aks get-credentials** command to download the kubeconfig file, but when users attempt to execute kubectl commands against the cluster, they will be instructed to log in with their Microsoft Entra ID credentials and their assigned roles will determine what they can do within the cluster.

To grant permissions to the AKS cluster, you will need to assign a role. The following built-in roles for Azure-RBAC enabled clusters are available to assign to users.

- [Azure Kubernetes Service RBAC Admin](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-admin)
- [Azure Kubernetes Service RBAC Cluster Admin](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-cluster-admin)
- [Azure Kubernetes Service RBAC Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-reader)
- [Azure Kubernetes Service RBAC Writer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-writer)

Using Azure Cloud Shell, run the following command to get the AKS cluster credentials

```bash
az aks get-credentials --resource-group myresourcegroup --name myakscluster
```

Create a namespace for the developer to use.

```bash
kubectl create namespace dev
```

Since this is the first time you are running a kubectl command, you will be prompted to log in against Microsoft Entra ID. You will need to follow the same login process you went through to login into your Azure subscription but since you've already logged in before, you simply need to click through the prompts (no need to re-enter passwords). After you have logged in, the command to create the namespace should be successful.

> [!KNOWLEDGE]
> The kubelogin plugin is used to authenticate with Microsoft Entra ID and can be easily installed with the following command: `az aks install-cli`. So if you run into an error when trying to log in, you may need to install the plugin.

Run the following command to get the AKS cluster's resource ID.

```bash
AKS_ID=$(az aks show --resource-group myresourcegroup --name myakscluster --query id --output tsv)
```

Run the following command to get the developer's user principal ID.

```bash
DEV_USER_PRINCIPAL_ID=$(az ad user show --id @lab.CloudPortalCredential(User2).Username --query id --output tsv)
```

Run the following command to assign the **Azure Kubernetes Service RBAC Writer** role to the developer and have the permissions scoped only to the **dev** namespace. Scoping the permissions to the namespace ensures that the developer can only access the resources within the namespace and not the entire cluster.

```bash
az role assignment create --role "Azure Kubernetes Service RBAC Writer" --assignee $DEV_USER_PRINCIPAL_ID --scope $AKS_ID/namespaces/dev
```

When you logged in to access the Kubernetes API via the kubectl command, you were prompted to log in with your Microsoft Entra ID. The kubelogin plugin stored the OIDC token in the **~/.kube/cache/kubelogin** directory. In order to quickly test the permissions of a different user, we can simply move the JSON file to a different directory.

Run the following command to move the cached credentials to its parent directory.

```bash
mv ~/.kube/cache/kubelogin/*.json ~/.kube/cache/
```

Now, run the following command to get the dev namespace. This trigger a new authentication prompt. Proceed to log in with the developer's user account.

```bash
kubectl get namespace dev
```

After logging in, head back to your terminal. You should see the **dev** namespace.

Run the following command to check to see if the current user can create a pod in the **dev** namespace.

```bash
kubectl auth can-i create pods --namespace dev
```

You should see the output **yes**. This means the developer has the necessary permissions to create pods in the **dev** namespace.

Let's put this to the test and deploy a sample application in the assigned namespace using Helm.

Run the following command to add the Helm repository for the AKS Store Demo application.

```bash
helm repo add aks-store-demo https://azure-samples.github.io/aks-store-demo
```

Run the following command to install the AKS Store Demo application in the **dev** namespace.

```bash
helm install demo aks-store-demo/aks-store-demo-chart --namespace dev
```

The helm install command should show a status of "deployed". This means that the application has successfully deployed in the **dev** namespace. But it will take a few minutes to deploy so let's move on.

Finally, let's check to see if the developer can create a pod in the **default** namespace.

```bash
kubectl auth can-i create pods --namespace default
```

You should see the output **no**. This means the developer does not have the necessary permissions to create Pods in the default namespace.

Great job! You have successfully granted permissions to the AKS cluster.

> [!IMPORTANT]
> After testing the permissions, delete the developer user's cached credentials, then move the admin user's cached credentials back to the **~/.kube/cache/kubelogin** directory by running the following commands.

```bash
rm ~/.kube/cache/kubelogin/*.json
mv ~/.kube/cache/*.json ~/.kube/cache/kubelogin/
```

### Deployment Safeguards

As you unleash your developers to deploy their applications in the AKS cluster, you want to ensure that they are following best practices and policies. [Deployment Safeguards](https://learn.microsoft.com/azure/aks/deployment-safeguards) is a feature in AKS Automatic that helps enforce best practices and policies for your AKS clusters. It is implemented via [Azure Policy](https://learn.microsoft.com/azure/governance/policy/overview) and a set of policies known as an [initiative](https://learn.microsoft.com/azure/governance/policy/concepts/initiative-definition-structure) is assigned to your AKS cluster to ensure that resources running within it are secure, compliant, and well-managed. The compliance state of the cluster resources are reported back to Azure Policy and can be viewed in the Azure Portal.

The set of policies that are included with Deployment Safeguards are documented [here](https://learn.microsoft.com/azure/aks/deployment-safeguards#deployment-safeguards-policies). Read carefully through each policy description, the targeted resource, and the mutation that can be applied when the feature is set to **Enforcement** mode. AKS Automatic defaults to **Warning** mode which simply displays warnings in the terminal; however, when in Enforcement mode, polices will be strongly enforced by either mutating deployments to comply with the policies or denying deployments that violate policy. Therefore, it is important to understand the impact of each policy before enabling Enforcement mode.

Run the following command to deploy a pod without any best practices in place.

```bash
kubectl run mynginx --image=nginx:latest
```

You should see the following warning messages in the output.

```text
Warning: [azurepolicy-k8sazurev2containerenforceprob-e00c7e64611b1137ed2b] Container <nginx> in your Pod <nginx> has no <livenessProbe>. Required probes: ["readinessProbe", "livenessProbe"]
Warning: [azurepolicy-k8sazurev2containerenforceprob-e00c7e64611b1137ed2b] Container <nginx> in your Pod <nginx> has no <readinessProbe>. Required probes: ["readinessProbe", "livenessProbe"]
Warning: [azurepolicy-k8sazurev3containerlimits-4e7bbc2617e5447639a7] container <nginx> has no resource limits
Warning: [azurepolicy-k8sazurev1containerrestrictedi-88f886218244b623dd93] nginx in default does not have imagePullSecrets. Unauthenticated image pulls are not recommended.
pod/nginx created
```

These warnings are here to help remind you of the best practices that should be followed when deploying Pods in the AKS cluster. There are warnings about not having a [livenessProbe](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-a-liveness-http-request), [readinessProbe](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes), [resource limits](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#requests-and-limits), and [imagePullSecrets](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/#create-a-pod-that-uses-your-secret).

So let's try this again with some best practices in place. Run the following command to delete the pod that was just created.

```bash
kubectl delete pod mynginx
```

Run the following command to redeploy the pod with some best practices in place.

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: mynginx
  name: mynginx
spec:
  containers:
  - image: nginx:latest
    name: mynginx
    resources:
      limits:
        cpu: 5m
        memory: 4Mi
      requests:
        cpu: 3m
        memory: 2Mi
    livenessProbe:
      tcpSocket:
        port: 80
      initialDelaySeconds: 3
      periodSeconds: 3
    readinessProbe:
      tcpSocket:
        port: 80
      initialDelaySeconds: 3
      periodSeconds: 3
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
EOF
```

The pod manifest is a bit more complex this time but it includes the following best practices:

- resource limits and requests
- livenessProbe
- readinessProbe

> [!NOTE]
> You should now see that we've satisfied all but one best practice, which we'll address later.

Nice work! Now you know where to expect warnings and how to address some of them. You can also view the compliance state of the cluster resources in the Azure Portal by navigating to the **Policy** blade. To get there, type `policy` in the search bar and click on **Policy** under **Services**.

In the **Overview** section, you will see the **AKS Deployment Safeguards Policy Assignment**. Click on the policy assignment to view the compliance state of the cluster resources.

### Custom policy enforcement

[Azure Policy for AKS](https://learn.microsoft.com/azure/aks/use-azure-policy) has been enabled when AKS Automatic assigned Deployment Safeguards policy initiative. This means you can also leverage other Azure Policy definitions (built-in or custom) to enforce organizational standards and compliance. When Azure Policy for AKS feature is enabled, [Open Policy Agent (OPA) Gatekeeper](https://kubernetes.io/blog/2019/08/06/opa-gatekeeper-policy-and-governance-for-kubernetes/) is deployed in the AKS cluster. OPA Gatekeeper is a policy engine for Kubernetes that allows you to enforce policies written using [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/), a high-level declarative language.

These Pods are running in the **gatekeeper-system** namespace.

```bash
kubectl get pods -n gatekeeper-system
```

Although OPA Gatekeepr is running in the cluster, it is worth noting that this OPA Gatekeeper cannot be used outside of Azure Policy. If you want to implement a well-known or commonly used [ConstraintTemplate](https://open-policy-agent.github.io/gatekeeper/website/docs/constrainttemplates/), you'll need to translate it to an Azure Policy definition and assign it to the AKS cluster. There are **azure-policy-\*** Pods running in the cluster that are responsible for listening to Azure Policy assignments, translating them to OPA Gatekeeper ConstraintTemplates, and reporting the results back up to Azure Policy.

Let's illustrate this by attempting to deploy a commonly used ConstraintTemplate that limits container images to only those from approved container registries. Run the following command to attempt to deploy the ConstraintTemplate.

```bash
kubectl apply -f https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate.yaml
```

You will see a message "_This cluster is governed by Azure Policy. Policies must be created through Azure._"

So we need to translate this ConstraintTemplate to an Azure Policy definition. Good news is that you can use the [Azure Policy extension for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=AzurePolicy.azurepolicyextension) to help with this process.

Open VS Code and make sure the Azure Policy extension is installed. To activate the extension, press **Ctrl+Shift+P** on your keyboard to open the command palette and type **Azure: Sign in** then use the web browser to authenticate with your admin user account.

> [!NOTE]
> If you see multiple sign-in options, choose the one that has `azure-account.login` next to it.

Next, press **Ctrl+Shift+P** again and type **Azure: Select Subscriptions** then select the subscription that contains the AKS cluster.

> [!NOTE]
> If you see multiple subscriptions, choose the one that has `azure-account.selectSubscriptions` next to it.

In VS Code, click the **Azure Policy** icon and you should see subscription resources being loaded.

Using VS Code terminal, run the following command download the sample ConstraintTemplate file to your local machine.

```bash
curl -o constrainttemplate.yaml https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate.yaml
```

Open the file in VS Code and press **Ctrl+Shift+P** then type **Azure Policy for Kubernetes: Create Policy Definition from a Constraint Template** and select the **Base64Encoded** option.

This will generate a new Azure Policy definition in the JSON format. You will need to fill in details everywhere you see the text `/* EDIT HERE */`. For **apiGroups** field, you can use the value `[""]` to target all API groups and for the **kind** field, you can use the value `["Pod"]` to target Pods.

> [!NOTE]
> The extension process might take a few minutes to complete. If you cannot get the extension to generate that's okay, you will use a sample JSON file to create the policy definition in the next step.

With the Azure Policy definition written, you can create the policy definition in the Azure Portal. Open this [link](https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate-as-policy.json) and copy the JSON to the clipboard.

Navigate to the Azure Portal and type `policy` in the search bar.

Click on **Policy** under **Services**, then click on **Definitions** under the **Authoring** section.

Click on **+ Policy definition** then enter the following details:

- **Definition location**: Click the button next to the textbox, then select your subscription
- **Name**: `[AKS] Approved registries only`
- **Description**: `This policy requires that all containers in an AKS cluster are sourced from approved container registries.`
- **Category**: Click **Use existing** then select **Kubernetes** from the dropdown
- **Policy rule**: Paste the JSON you copied from the link above

Click **Save** then click on **Assign policy** button.

In the **Basics** tab, enter the following details:

- **Scope**: Click the button next to the textbox, select the resource group that contains the AKS cluster, and don't forget to click **Select**
- Leave the rest of the fields as default

Click **Next**

In the **Parameters** enter the following details:

- Uncheck the **Only show parameters that need input or review** checkbox
- **Effect**: `deny`
- **Namespace exclusions**: `["kube-system","gatekeeper-system","app-routing-system","azappconfig-system"]`
- **Image registry**: Enter your container registry URL, for example `mycontainerregistry.azureci.io/`

Click **Review + create** then click **Create**

> [!TIP]
> This policy assignment can take up to 20 minutes to take effect. You can try to speed up the policy scan with the following command: `az policy state trigger-scan --resource-group myresourcegroup --no-wait`

For more information on how to create a policy definition from a ConstraintTemplate or MutationTemplate, refer to the following documentation links:

- [Create policy definition from a constraint template or mutation template](https://learn.microsoft.com/azure/governance/policy/how-to/extension-for-vscode#create-policy-definition-from-a-constraint-template-or-mutation-template)
- [Understand Azure Policy for Kubernetes clusters](https://learn.microsoft.com/azure/governance/policy/concepts/policy-for-kubernetes)
- [OPA Gatekeeper Library](https://github.com/open-policy-agent/gatekeeper-library/)

Great job! You have successfully enforced custom policies in the AKS cluster. Once the policy assignment has taken effect, you can try deploying a pod with an image from an unapproved container registry to see the policy in action.

===

## Secrets and config management

Developers need a way to integrate their workloads with Azure services and make the configs available to their workloads in the cluster. They also need to ensure password-less authentication with Microsoft Entra ID is leveraged as much as possible. This section aims to get AKS operators comfortable with setting up a centralized configuration store, syncing configs to the cluster as Kubernetes ConfigMaps, and setting up connectors to integrate with other Azure services.

### Syncing configurations to the cluster

Azure Key Vault is a cloud service for securely storing and accessing secrets. A secret is anything that you want to tightly control access to, such as API keys, passwords, or certificates. Azure App Configuration is a managed service that helps developers centralize their application configurations. It provides a service to store, manage, and retrieve application settings and feature flags.

We can leverage these two services to store our application configurations and secrets and make them available to our workloads running in the AKS cluster.

#### Azure Key Vault

Run the following command to create an Azure Key Vault.

```bash
KV_NAME=$(az keyvault create --name mykeyvault$RANDOM --resource-group myresourcegroup --query name -o tsv)
```

Assign yourself the **Key Vault Secrets Administrator** role to the Azure Key Vault.

```bash
az role assignment create --role "Key Vault Administrator" --assignee $(az ad signed-in-user show --query id -o tsv) --scope $(az keyvault show --name $KV_NAME --query id -o tsv)
```

Run the following command to create a secret in the Azure Key Vault.

```bash
az keyvault secret set --vault-name $KV_NAME --name MySecret1 --value MySecretValue1
```

#### Azure App Configuration

Run the following command to create an Azure App Configuration store.

```bash
AC_NAME=$(az appconfig create --name myappconfig$RANDOM --resource-group myresourcegroup --assign-identity --query name -o tsv)
```

It's best practice to create a User-Assigned Managed Identity to access the Azure App Configuration store. This way, you can control the access to the store and ensure that only the workloads that need access to the configurations can access them.

```bash
AC_ID=$(az identity create --name $AC_NAME-id --resource-group myresourcegroup --query id -o tsv)
```

> [!KNOWLEDGE]
> You might be wondering why we are creating a User-Assigned Managed Identity for the Azure App Configuration store even though a system-assigned managed identity was created for it. The reason is that the system-assigned managed identity cannot be used for AKS Workload Identity as it does not support federated credentials.

Create some sample key-value pairs in the Azure App Configuration store.

```bash
az appconfig kv set --name $AC_NAME --key MyKey1 --value MyValue1 --yes
```

Now add a key vault reference to the Azure App Configuration store.

```bash
az appconfig kv set-keyvault --name $AC_NAME --key MySecret1 --secret-identifier https://$KV_NAME.vault.azure.net/secrets/MySecret1 --yes
```

The Azure App Configuration store will have a reference to the secret in the Azure Key Vault and the intent is to use the user-assigned managed identity to access the secret in the key vault. However, this identity needs to be granted access to the key vault. Run the following command to allow the configuration store's managed identity to read secrets from the key vault.

```bash
az role assignment create --role "Key Vault Secrets User" --assignee $(az identity show --id $AC_ID --query principalId -o tsv) --scope $(az keyvault show --name $KV_NAME --query id -o tsv)
```

#### Azure App Configuration Provider for Kubernetes

AKS offers an extension called the Azure App Configuration Provider for Kubernetes that allows you to sync configurations from Azure App Configuration to Kubernetes ConfigMaps. This extension is not installed by default in AKS Automatic clusters, so you will need to install it manually.

```bash
az k8s-extension create \
  --cluster-type managedClusters \
  --cluster-name myakscluster \
  --resource-group myresourcegroup \
  --name appconfigurationkubernetesprovider \
  --extension-type Microsoft.AppConfiguration \
  --auto-upgrade false \
  --version 2.0.0
```

> This can take up to 5 minutes to complete.

After the extension has been created, you can verify that the Pods are running.

```bash
kubectl get pods -n azappconfig-system
```

#### AKS Service Connector

We also want to establish a passwordless connection between the AKS cluster and the Azure App Configuration store. We can do this by leveraging the AKS Service Connector. The AKS Service Connector is a managed service that allows you to connect your AKS cluster to other Azure services. It will take care of manual tasks like setting up the necessary Azure RBAC roles and federated credentials for authentication, creating the necessary Kubernetes Service Account, and creating any firewall rules needed to allow the AKS cluster to communicate with the Azure service.

```bash
az aks connection create appconfig --kube-namespace dev --name myakscluster --resource-group myresourcegroup --target-resource-group myresourcegroup --app-config $AC_NAME --workload-identity $AC_ID --client-type none
```

> [!KNOWLEDGE]
> The AKS Service Connector is used here for the Azure App Configuration Provider for Kubernetes pods to use to authenticate with the Azure App Configuration store. The authentication is handled in a passwordless manner using AKS Workload Identity. The AKS Service Connector can also be used to connect your application pods to other Azure services like Azure Key Vault, Azure Storage, and Azure SQL Database, etc. For more information, refer to the [service connector documentation](https://learn.microsoft.com/azure/service-connector/quickstart-portal-aks-connection?tabs=UMI).

#### Syncing configurations

The Azure App Configuration Provider for Kubernetes extension also installed new Custom Resource Definitions (CRDs) which you can use to sync configurations from Azure App Configuration to Kubernetes ConfigMaps.

We can now deploy a sync configuration manifest to sync the configurations from Azure App Configuration to Kubernetes ConfigMaps. But first we will need some values for the manifest.

Run the following command to get the Azure App Configuration store's endpoint.

```bash
AC_ENDPOINT=$(az appconfig show -n $AC_NAME --query endpoint --output tsv)
```

To connect to the Azure App Configuration store, it is best to use Workload Identity. The AKS Automatic cluster is already configured with Workload Identity, and you created the Azure App Configuration connection using the User-Assigned Managed Identity that you created earlier. The Service Connector created a Kubernetes Service Account that you can use to sync the configurations.

Run the following command to get the Kubernetes ServiceAccount name.

```bash
SA_NAME=$(kubectl get sa -n dev -o jsonpath='{.items[?(@.metadata.name!="default")].metadata.name}')
```

Using the values you collected, create a sync configuration manifest.

```bash
kubectl apply -n dev -f - <<EOF
apiVersion: azconfig.io/v1
kind: AzureAppConfigurationProvider
metadata:
  name: devconfigs
spec:
  endpoint: $AC_ENDPOINT
  configuration:
    refresh:
      enabled: true
      interval: 10s
      monitoring:
        keyValues:
        - key: MyKey1
  target:
    configMapName: myconfigmap
  auth:
    workloadIdentity:
      serviceAccountName: $SA_NAME
  secret:
    auth:
      workloadIdentity:
        serviceAccountName: $SA_NAME
    target:
      secretName: mysecret
EOF
```

The sync manifest above will sync the key-value pairs from the Azure App Configuration store to the Kubernetes ConfigMap. Every 10s the configurations will be refreshed and the key MyKey1 will be treated as the sentinel key and monitored for changes. When the value for MyKey1 changes in the Azure App Configuration store, the Kubernetes ConfigMap will be updated. The configuration store also has a secret reference to the Azure Key Vault secret MySecret1. The secret will be synced to the Kubernetes Secret. You could also enable a refresh interval for the secret to be updated just as we did for the key-value pairs, but for this lab, we will leave it as is.

After a minute or so, you can check to see if the key-value pairs in the configuration store have been synced to the Kubernetes ConfigMap.

```bash
kubectl get cm -n dev myconfigmap -o jsonpath='{.data}'
```

Also, check to see if the secret in the configuration store has been synced to the Kubernetes Secret.

```bash
kubectl get secret -n dev mysecret -ojsonpath='{.data.MySecret1}' | base64 -d
```

> [!KNOWLEDGE]
> While syncing secrets from Azure App Configuration to Kubernetes Secrets is supported, it is not best to keep secrets in Kubernetes Secrets because Kubernetes Secrets are not encrypted but rather base64 encoded. If you need to authenticate with Azure services from your applications, it is best to use AKS Workload Identity and Microsoft Entra ID for passwordless authentication.

The app config sync is set to refresh every 10 seconds and you can choose which key to listen for changes. In this case, we are only listening for changes to the Key1 configuration. If you update the value for Key1 in the Azure App Configuration store, you should see the value updated in the Kubernetes ConfigMap after the next refresh.

Run the following command to update the value for Key1 in the Azure App Configuration store.

```bash
az appconfig kv set --name $AC_NAME --key MyKey1 --value MyNewValue1 --yes
```

After a minute or so, you can check to see if the configurations have been updated in the Kubernetes ConfigMap.

```bash
kubectl get cm -n dev myconfigmap -o jsonpath='{.data}'
```

Great job! You have successfully synced configurations from Azure App Configuration to Kubernetes ConfigMaps and Secrets.

===

## Scaling

One key benefit of Kubernetes is its ability to scale workloads across a pool of nodes. One key differentiator of **Kubernetes in the cloud** is its ability to scale the node pool to handle more workloads to meet user demand. This section aims to get you comfortable with all the scaling capabilities of AKS Automatic and understand workload scheduling best practices.

### AKS Node Autoprovision

With AKS Automatic, the [Node Autoprovision](https://learn.microsoft.com/azure/aks/node-autoprovision?tabs=azure-cli) feature is enabled by default. AKS Node Autoprovision is the Azure implementation of the [Karpenter project](https://karpenter.sh) which was developed by friends at AWS and has been [donated to the Cloud Native Computing Foundation (CNCF)](https://aws.amazon.com/blogs/containers/karpenter-graduates-to-beta/). In short, Karpenter is a Kubernetes controller that automates the provisioning, right-sizing, and termination of nodes in a Kubernetes cluster.

> [!NOTE]
> The term **Node Autoprovision** may be used interchangeably with **Karpenter** in this lab.

The AKS Automatic cluster deploys a system node pool that will run all the system components; things that AKS Automatic will manage. As workloads are deployed to the cluster, Node Autoprovision will automatically scale up a new node on demand. As soon as you deploy an AKS Cluster, there are no user nodes running; just the system node pool. As you deploy workloads, the Node Autoprovision feature will automatically provision a new node to run the workload. Conversely, as you delete workloads, the Node Autoprovision feature will automatically scale down the number of nodes to save costs. But this means that pods will remain in pending state until the newly provisioned node is ready or the workloads will be disrupted as they are moved to other nodes during consolidation events. So you need to account for this when planning for high availability for your workloads.

There are a few key Karpenter concepts to understand when working with Node Autoprovision. Let's start by understanding the following concepts:

- **NodeClasses**: A [NodeClass](https://karpenter.sh/docs/concepts/nodeclasses/) is a set of constraints that define the type of node that should be provisioned. For example, you can define a NodeClass that specifies the type of VM, the region, the availability zone, and the maximum number of nodes that can be provisioned. In AKS, a default AKSNodeClass is created for you which specifies the OS image (currently [AzureLinux](https://github.com/microsoft/azurelinux)), and OS disk size of 128GB.
- **NodePool**: A [NodePool](https://karpenter.sh/docs/concepts/nodepools/) is a set of nodes that are provisioned based on a NodeClass. You can have multiple NodePools in a cluster, each with its own set of constraints. In AKS Automatic, the default NodePool is created for you. You can create additional NodePools with specific constraints if you have workloads that require specific VM attributes. For examples of various NodePool constraints, see the the [examples](https://github.com/Azure/karpenter-provider-azure/tree/main/examples/v1beta1) in the Karpenter Azure provider repository.
- **NodeClaims**: A [NodeClaim](https://karpenter.sh/docs/concepts/nodeclaims/) is a request for a node that matches a set of constraints. When a NodeClaim is created, Karpenter will provision a node that matches the constraints specified in the NodeClaim, and thus, a VM is born!

As mentioned above, the default NodeClass and default NodePool are created for you. So you can start deploying workloads right away. The default NodeClass is fairly generic and should be able to handle most workloads.

You can view the default NodePool by running the following command.

```bash
kubectl get nodepools default -o yaml
```

However, you may want to create additional NodePools with specific constraints if you have teams that need to deploy workloads that require specific VM attributes. Let's create a new NodePool with specific constraints. Run the following command to create a new NodePool.

```bash
kubectl apply -f - <<EOF
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  annotations:
    kubernetes.io/description: General purpose NodePool for dev workloads
  name: devpool
spec:
  disruption:
    budgets:
    - nodes: 100%
    consolidationPolicy: WhenUnderutilized
    expireAfter: Never
  template:
    metadata:
      labels:
        team: dev
    spec:
      nodeClassRef:
        name: default
      taints:
        - key: team
          value: dev
          effect: NoSchedule
      requirements:
      - key: kubernetes.io/arch
        operator: In
        values:
        - arm64
      - key: kubernetes.io/os
        operator: In
        values:
        - linux
      - key: karpenter.sh/capacity-type
        operator: In
        values:
        - on-demand
      - key: karpenter.azure.com/sku-family
        operator: In
        values:
        - D
EOF
```

This NodePool manifest creates a new NodePool called **devpool** with the following constraints:

- The NodePool is labeled with `team=dev`
- The NodePool only supports `arm64` architecture
- The NodePool only supports `linux` operating system
- The NodePool only supports `on-demand` capacity type
- The NodePool only supports `D` SKU family

Now that the dev team has their own NodePool, you can try scheduling a pod that tolerates the taint that will be applied to the dev nodes. Before we do that, let's import the product-service container image into the Azure Container Registry.

> [!NOTE]
> Remember we created a new policy that only allows images from specified container registries.

```bash
ACR_NAME=$(az acr list --resource-group myresourcegroup --query "[0].name" -o tsv)
az acr import --name $ACR_NAME --source ghcr.io/azure-samples/aks-store-demo/product-service:1.5.2 --image product-service:1.5.2
```

Run the following command to create a pod that tolerates the taint.

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: dev
spec:
  replicas: 3
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      containers:
      - name: product-service
        image: $ACR_NAME.azurecr.io/product-service:1.5.2
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: team
                operator: In
                values:
                - dev
      tolerations:
      - key: "team"
        operator: "Equal"
        value: "dev"
        effect: "NoSchedule"
EOF
```

This pod manifests ensures that the workload will be scheduled on a Node that has the `team=dev` taint with the `nodeAffinity` and `tolerations` fields. You can check to see if the pod has been scheduled by running the following command.

```bash
kubectl get pods product-service -n dev -o wide
```

You should see the pod in **Pending** state. This is because the dev NodePool does not have any nodes provisioned yet. The AKS cluster will automatically provision a node in the dev NodePool to satisfy the pod's requirements.

Once the node has been provisioned, you should see the pod in **Running** state.

If you run the following command, you will be able to see the SKU that was used to provision the node.

```bash
kubectl get nodes -l karpenter.sh/nodepool=devpool -o custom-columns=NAME:'{.metadata.name}',OS:'{.status.nodeInfo.osImage}',ARCH:'{.status.nodeInfo.architecture}',SKU:'{.metadata.labels.karpenter\.azure\.com/sku-name}'
```

Congrats! You have successfully created a new NodePool for your dev team and have the proper constraints in place to ensure that the right workloads are scheduled on the right nodes.

### Workload scheduling best practices

With AKS Node Autoprovision, you can ensure that your dev teams have the right resources to run their workloads without having to worry about the underlying infrastructure. As demonstrated, you can create NodePools with specific constraints to handle different types of workloads. But it is important to remember that the workload manifests include the necessary scheduling attributes such as `nodeAffinity` and `tolerations` to ensure that the workloads are scheduled on the right nodes. Otherwise, they may be scheduled on the default NodePool which is fairly generic and welcomes all workloads.

When deploying workloads to Kubernetes, it is important to follow best practices to ensure that your workloads are scheduled efficiently and effectively. This includes setting resource requests and limits, using PodDisruptionBudgets, and setting pod anti-affinity rules.

Let's explore a few best practices for workload scheduling.

#### Resource requests

When deploying workloads to Kubernetes, it is important to set resource requests and limits. Resource requests are used by the scheduler to find the best node to place the pod on. Resource limits are used to prevent a pod from consuming more resources than it should. By setting resource requests and limits, you can ensure that your workloads are scheduled efficiently and effectively. We saw an example of this earlier when we deployed a pod with resource requests and limits after seeing warnings about not having them set.

But what if you don't know what values to set for the resource requests and limits? This is where the [Vertical Pod Autoscaler](https://learn.microsoft.com/azure/aks/vertical-pod-autoscaler) comes in. The Vertical Pod Autoscaler automatically adjusts the resource requests and limits for your workloads based on their usage.

In the previous section, we deployed the product-service sample app without any resource requests and limits. Run the following command to confirm there are no resource requests and limits set for the product-service.

```bash
kubectl describe po -n dev $(kubectl get pod -n dev -l app=product-service  -o jsonpath='{.items[0].metadata.name}') | grep -i requests -A2
```

Now, deploy a VerticalPodAutoscaler resource to automatically adjust the resource requests for the product-service.

```bash
kubectl apply -f - <<EOF
apiVersion: "autoscaling.k8s.io/v1"
kind: VerticalPodAutoscaler
metadata:
  name: product-service-vpa
  namespace: dev
spec:
  targetRef:
    apiVersion: "apps/v1"
    kind: Deployment
    name: product-service
EOF
```

Watch the pod for a few minutes and you should see the pod being restarted with the updated resource requests and limits.

```bash
kubectl get pod -l app=product-service -n dev -w
```

> [!IMPORTANT]
> The Vertical Pod Autoscaler will evict pods only if the number of replicas is greater than 1. Otherwise, it will not evict the pod.

Once you see the pods being restarted, press **Ctrl+C** to exit the watch then run the following command to confirm the resource requests and limits have been set.

```bash
kubectl describe po -n dev $(kubectl get pod -n dev -l app=product-service  -o jsonpath='{.items[0].metadata.name}') | grep -i requests -A2
```

With requests in place, the scheduler can make better decisions about where to place the pod. The Vertical Pod Autoscaler will also adjust the resource requests based on the pod's usage.

#### Dealing with disruptions

When deploying workloads to Kubernetes, it is important to ensure that your workloads are highly available and resilient to voluntary and involuntary disruptions. This is especially important when running workloads with Karpenter because nodes can be provisioned and deprovisioned automatically. There are a few best practices to follow to ensure that your workloads are highly available and resilient to disruptions.

The first thing you can do is to set [PodDisruptionBudgets](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/#pod-disruption-budgets) for your workloads. PodDisruptionBudgets are used to ensure that a certain number of Pods are available during maintenance or disruptions. By setting PodDisruptionBudgets, you can ensure that your workloads are not abruptly terminated during maintenance or node scale down events.

The YAML spec for a PodDisruptionBudget is relatively easy to write and understand. But if you are not sure of how to write one, you can use Microsoft Copilot for Azure to generate the YAML for you.

Follow these steps to create a PodDisruptionBudget for the product-service running in the dev namespace.

- Navigate to your AKS cluster in the Azure Portal.
- Under the **Kubernetes resources** section, click on **Workloads**, then click on the **+ Create** button to expand the dropdown.
- Click on the **Apply a YAML** button. Here you will be presented with a blank YAML editor.
- Put your cursor in the editor and press **Alt+I** to open the prompt dialog.
- In the textbox type the following text and click the **send** button.
  ```text
  create a pod disruption budget for the product-service running in the dev namespace to run at least 1 replica at all times
  ```
- You will see the YAML generated for you. Click **Apply** then the **Add** button to create the PodDisruptionBudget.

Karpenter also supports [Consolidation Policies](https://karpenter.sh/docs/concepts/disruption/#consolidation) which are used to determine when to consolidate nodes. By default, Karpenter will consolidate nodes when they are underutilized. This means that Karpenter will automatically scale down nodes when they are not being used to save costs. You can also set [node disruption budgets](https://karpenter.sh/docs/concepts/disruption/#nodepool-disruption-budgets) in the NodePool manifest to specify the percentage of nodes that can be consolidated at a time. Lastly, if you want to simply prevent a pod or node from being disrupted, you can use the `karpenter.sh/do-not-disrupt: true` annotation at the [pod level](https://karpenter.sh/docs/concepts/disruption/#pod-level-controls) or at the [node level](https://karpenter.sh/docs/concepts/disruption/#node-level-controls).

#### Pod affinity and anti-affinity

Pod affinity and anti-affinity are used to influence the scheduling of Pods in a Kubernetes cluster. We saw an example of this earlier when we deployed a pod with node affinity and tolerations to ensure that the pod was scheduled on a node that matched the criteria. Pod anti-affinity is used to ensure that Pods are not scheduled on the same node. If you noticed, the product-service deployment included 3 replicas but they were all scheduled on the same node.

You can confirm this by running the following command:

```bash
kubectl get po -n dev -l app=product-service -o wide
```

If the node goes away for whatever reason, all 3 replicas will be disrupted. What's worst is if the node encountered a hardware failure, all 3 replicas will be disrupted at the same time even with the PodDisruptionBudget in place. To ensure that the replicas are scheduled on different nodes, you can set Pod anti-affinity rules.

Run the following command to update the product-service deployment with Pod anti-affinity rules.

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: dev
spec:
  replicas: 3
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      containers:
      - name: product-service
        image: $ACR_NAME.azurecr.io/product-service:1.5.2
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: team
                operator: In
                values:
                - dev
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app
                    operator: In
                    values:
                      - product-service
              topologyKey: "kubernetes.io/hostname"
      tolerations:
      - key: "team"
        operator: "Equal"
        value: "dev"
        effect: "NoSchedule"
EOF
```

In this updated deployment manifest, we added a `podAntiAffinity` field to ensure that the replicas are scheduled on different nodes. The `topologyKey` field specifies the key of the node label that the anti-affinity rule should be applied to. In this case, we are using the `kubernetes.io/hostname` key which is the hostname of the node.

Run the following command to watch the pods and confirm that the replicas are scheduled on different nodes.

```bash
kubectl get po -n dev -l app=product-service -o wide -w
```

Once you see the pods being scheduled on different nodes, press **Ctrl+C** to exit the watch.

#### Pod topology spread constraints

To take the concept of spreading pods across nodes even further, you can use [Pod topology spread constraints](https://kubernetes.io/docs/concepts/workloads/pods/pod-topology-spread-constraints/) over pod anti-affinity rules. Pod topology spread constraints are used to ensure that Pods are spread across different fault domains such as Azure availability zones. With AKS Automatic, one of the requirements is to deploy to a region that supports availability zones. Therefore, you can be sure that the nodes provisioned by Karpenter will be spread across different availability zones.

Run the following command to update the product-service deployment with pod topology spread constraints.

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: dev
spec:
  replicas: 3
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      containers:
      - name: product-service
        image: $ACR_NAME.azurecr.io/product-service:1.5.2
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: team
                operator: In
                values:
                - dev
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app
                    operator: In
                    values:
                      - product-service
              topologyKey: "kubernetes.io/hostname"
      tolerations:
      - key: "team"
        operator: "Equal"
        value: "dev"
        effect: "NoSchedule"
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: "topology.kubernetes.io/zone"
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: product-service
EOF
```

> [!KNOWLEDGE]
> Pod anti-affinity rules will spread the pods across different nodes, but there's no guarantee that the nodes will be in different availability zones. Pod topology spread constraints will ensure that the pods are spread across different availability zones as the topology key is set to `topology.kubernetes.io/zone`. The `maxSkew` field specifies the maximum difference between the number of pods in any two zones. The `whenUnsatisfiable` field specifies what action to take if the constraint cannot be satisfied. In this case, we set it to `DoNotSchedule` which means that the pod will not be scheduled if the constraint cannot be satisfied. More information on spreading pods across different zones can be found [here](https://learn.microsoft.com/azure/aks/aks-zone-resiliency#ensure-pods-are-spread-across-azs).

Run the following command and you should start to see the nodes coming up in different availability zones.

```bash
kubectl get nodes -o custom-columns=NAME:'{.metadata.name}',OS:'{.status.nodeInfo.osImage}',SKU:'{.metadata.labels.karpenter\.azure\.com/sku-name}',ZONE:'{.metadata.labels.topology\.kubernetes\.io/zone}'
```

Excellent! You have now know about some of the best practices for workload scheduling in Kubernetes to ensure that your workloads are scheduled efficiently and effectively.
