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

This lab is meant to be a hands-on experience for platform operators and DevOps engineers looking to get started with AKS Automatic. You will learn how to automate many administrative tasks in Kubernetes and make it easier for development teams to deploy their apps while maintaining security and compliance. AKS Automatic is a new mode of operation for Azure Kubernetes Service (AKS) that simplifies cluster management, reduces manual tasks, and builds in enterprise-grade best practices and policy enforcement.

### Objectives

-

### Prerequisites

The lab environment has been pre-configured for you with an AKS Automatic cluster pre-provisioned with monitoring and logging enabled.

You will need the Azure CLI installed on your local machine. You can install it from [here](https://docs.microsoft.com/cli/azure/install-azure-cli).

With the Azure CLI installed, you will need to install the **aks-preview** extension to leverage preview features in AKS.

Open a terminal, log into Azure, and install the AKS preview extension with the following command:

```bash
az login
az extension add --name aks-preview
```

Set the default location for resources we will create in this lab.

```bash
az configure --defaults location=$(az group show -n myResourceGroup --query location -o tsv)
```

===

## Security

Security above all else is the mantra! With AKS Automatic, you can leverage Microsoft Entra ID for authentication and authorization right out of the box. This means that setting up Kubernetes Role-Based Access Control (RBAC) is as simple as assigning roles to users, groups, and service principals to manage access to the cluster. When users try to execute kubectl commands against the cluster, they will be instructed to log in with their Microsoft Entra ID credentials for authentication and their assigned roles will determine what they can do within the cluster.

### Granting permissions to the AKS cluster

The first thing you need to do is grant the necessary permissions to the AKS cluster. AKS Automatic clusters are Azure RBAC enabled, which means you can assign roles to users, groups, and service principals to manage access to the cluster. When users try to execute kubectl commands against the cluster, they will be instructed to log in with their Microsoft Entra ID credentials for authentication and their assigned roles will determine what they can do within the cluster.

To grant permissions to the AKS cluster, you will need to assign a role. The following built-in roles for Azure-RBAC enabled clusters are available to assign to users.

- [Azure Kubernetes Service RBAC Admin](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-admin)
- [Azure Kubernetes Service RBAC Cluster Admin](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-cluster-admin)
- [Azure Kubernetes Service RBAC Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-reader)
- [Azure Kubernetes Service RBAC Writer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-writer)

Using Azure Cloud Shell, run the following command to get the AKS cluster credentials

```bash
az aks get-credentials --resource-group myResourceGroup --name myAKSCluster
```

Create a namespace for the developer to use.

```bash
kubectl create namespace dev
```

Since this is the first time you are running a kubectl command, you will be prompted to log in against Microsoft Entra ID. After you have logged in, the command to create the namespace should be successful.

> The kubelogin plugin is used to authenticate with Microsoft Entra ID and can be easily installed with the following command.

```bash
az aks install-cli
```

Run the following command to get the AKS cluster's resource ID and the developer's user principal ID.

```bash
AKS_ID=$(az aks show --resource-group myResourceGroup --name myAKSCluster --query id --output tsv)
DEV_USER_PRINCIPAL_ID=$(az ad user show --id @lab.CloudPortalCredential(User2).Username --query id --output tsv)
```

Run the following command to assign the **Azure Kubernetes Service RBAC Writer** role to the developer and have the permissions scoped only to the **dev** namespace.

```bash
az role assignment create --role "Azure Kubernetes Service RBAC Writer" --assignee $DEV_USER_PRINCIPAL_ID --scope $AKS_ID/namespaces/dev
```

When you logged in to access the Kubernetes API via the kubectl command, you were prompted to log in with your Microsoft Entra ID. The kubelogin plugin stored the OIDC token in the **~/.kube/cache/kubelogin** directory. In order to test the permissions with a different user, you can simply move it to a different directory.

Run the following command to move the cached credentials to the parent directory.

```bash
mv ~/.kube/cache/kubelogin/*.json ~/.kube/cache/
```

Run a kukbectl command to trigger a new login and authenticate with the developer's user account.

```bash
kubectl get namespace dev
```

After logging in, you should see the **dev** namespace. Next, check to see if the developer can create a Pod in the **dev** namespace by running the following command.

```bash
kubectl auth can-i create pods --namespace dev
```

You should see the output **yes**. This means the developer has the necessary permissions to create Pods in the **dev** namespace. Next test to see if the developer can create Pods in the default namespace. Let's put it to the test and deploy a sample application in the assigned namespace using Helm.

```bash
helm repo add aks-store-demo https://azure-samples.github.io/aks-store-demo
helm install demo aks-store-demo/aks-store-demo-chart --namespace dev --set aiService.create=true
```

You should the application has successfully deployed in the **dev** namespace.

> [!NOTE]
> The application will take a few minutes to deploy. We will come back to this later.

Now, check to see if the developer can create a Pod in the default namespace by running the following command.

```bash
kubectl auth can-i create pods --namespace default
```

You should see the output **no**. This means the developer does not have the necessary permissions to create Pods in the default namespace.

Great job! You have successfully granted permissions to the AKS cluster.

After testing the permissions, delete the developer user's cached credentials, then move the admin user's cached credentials back to the **~/.kube/cache/kubelogin** directory by running the following commands.

```bash
rm ~/.kube/cache/kubelogin/*.json
mv ~/.kube/cache/*.json ~/.kube/cache/kubelogin/
```

### Deployment Safeguards

As you unleash your developers to deploy their applications in the AKS cluster, you want to ensure that they are following best practices and policies. Deployment Safeguards is a feature in AKS Automatic that helps enforce best practices and policies for your AKS clusters. It is implemented via Azure Policy and a set of policies known as an Initiative is applied to your AKS cluster to ensure that resources running within it are secure, compliant, and well-managed. With AKS Automatic it is enabled in Warning mode.

The policies that are included with Deployment Safeguards are documented [here](https://learn.microsoft.com/azure/aks/deployment-safeguards#deployment-safeguards-policies). Read carefully through each Policy description, the targeted resource, and the mutation that can be applied when the feature is set to Enforcement mode. When in Enforcement mode, resources will be mutated to comply with the policies so it is important to understand the impact of each policy.

Try deploying a Pod without any best practices in place.

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

These warnings are here to help remind you of the best practices that should be followed when deploying Pods in the AKS cluster. You can see that there are warnings about not having a [livenessProbe](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-a-liveness-http-request), [readinessProbe](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes), [resource limits](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#requests-and-limits), and [imagePullSecrets](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/#create-a-pod-that-uses-your-secret).

Run the following command to delete the Pod.

```bash
kubectl delete pod mynginx
```

Now, deploy the Pod with some best practices in place.

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

You should now see that we've satisfied all but one best practice, which we'll address later.

### More policy with OPA

In addition to the Deployment Safeguards Azure Policy Initiative, you can also leverage other Azure Policy definitions to enforce organizational standards and compliance. Azure Policy for AKS is enabled by default in AKS Automatic and you can either assign built-in policies or create custom policies to enforce compliance. When the Azure Policy for AKS feature is enabled, Open Policy Agent (OPA) Gatekeeper is deployed in the AKS cluster. OPA Gatekeeper is a policy engine for Kubernetes that allows you to enforce policies written using Rego, a high-level declarative language.

These Pods are running in the **gatekeeper-system** namespace.

```bash
kubectl get pods -n gatekeeper-system
```

However, it is worth noting that the OPA Gatekeeper cannot be used outside of Azure Policy. If you want to implement a ConstraintTemplate, you'll need to translate it to an Azure Policy definition and assign it to the AKS cluster.

As an example, let's try deploying a new ConstraintTemplate to the AKS cluster.

```bash
kubectl apply -f https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate.yaml
```

We can work around this by translating the ConstraintTemplate to an Azure Policy definition using the Azure Policy extension for Visual Studio Code. You can install the extension from the Visual Studio Code Marketplace [here](https://marketplace.visualstudio.com/items?itemName=AzurePolicy.azurepolicyextension).

Open Visual Studio Code and make sure the Azure Policy extension is installed. Using your keyboard, press **Ctrl+Shift+P** to open the command palette and type **Azure: Sign in** then use the web browser to authenticate with your admin user account.

> [!NOTE]
> If you see multiple sign-in options, choose the one that has `azure-account.login` next to it.

Next, press **Ctrl+Shift+P** again and type **Azure: Select Subscriptions** then select the subscription that contains the AKS cluster.

> [!NOTE]
> If you see multiple subscriptions, choose the one that has `azure-account.selectSubscriptions` next to it.

Open the terminal in Visual Studio Code and download the ConstraintTemplate file to your local machine then open the file in Visual Studio Code by running the following commands.

```bash
wget https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate.yaml
code constrainttemplate.yaml
```

With the constrainttemplate.yaml file open in Visual Studio Code, press **Ctrl+Shift+P** and type **Azure Policy for Kubernetes: Create Policy Definition from a Constraint Template** then select the **Base64Encoded** option.

This will generate a new Azure Policy definition in the JSON format. You will need to fill in details everywhere you see the text `/* EDIT HERE */`. For **apiGroups** field, you can use the value `[""]` to target all API groups and for the **kind** field, you can use the value `["Pod"]` to target Pods.

Here is what the JSON should look like: https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate-as-policy.json

Let's deploy the custom policy definition and assign it to the AKS cluster.

Navigate to the Azure Portal and search for **Policy** in the search bar.

Click on **Azure Policy** and then click on **Definitions** under the **Authoring** section.

Click on **+ Policy definition** then enter the following details:

- **Definition location**: Click the button next to the textbox, then select your subscription
- **Name**: Enter `AKS Approved registries only`
- **Description**: Enter `This policy requires that all containers in an AKS cluster are sourced from approved container registries.`
- **Category**: Click **Use existing** then select **Kubernetes** from the dropdown
- **Policy rule**: Copy and paste the JSON from the the sample policy definition file [here](https://raw.githubusercontent.com/pauldotyu/ignite/refs/heads/main/constrainttemplate-as-policy.json)

Click **Save**

Next, click on **Assign policy** button and for **Scope** you can optionally click the button next to the textbox, then select the resource group that contains the AKS cluster.

Click **Next** then uncheck the **Only show parameters that need input or review** checkbox. This will enable you to change the **Effect** to **Deny**.

In the **Image registry** parameter, enter the value of `mcr.microsoft.com/` then click **Review + create**.

Click the **Create** button to assign the policy to the AKS cluster.

This can take up to 20 minutes to take effect. We will come back to this later.

For more information on how to create a policy definition from a ConstraintTemplate or MutationTemplate, refer to the following documentation links:

- [Create policy definition from a constraint template or mutation template](https://learn.microsoft.com/azure/governance/policy/how-to/extension-for-vscode#create-policy-definition-from-a-constraint-template-or-mutation-template)
- [Understand Azure Policy for Kubernetes clusters](https://learn.microsoft.com/azure/governance/policy/concepts/policy-for-kubernetes)
- [OPA Gatekeeper Library](https://github.com/open-policy-agent/gatekeeper-library/)

===

## Secrets and config management

Developers need a way to integrate their workloads with Azure services and make the configs available to their workloads in the cluster. They also need to ensure password-less authentication with Microsoft Entra ID is leveraged as much as possible. This section aims to get AKS operators comfortable with setting up a centralized configuration store, syncing configs to the cluster as Kubernetes ConfigMaps, and setting up connectors to integrate with other Azure services.

### Syncing configurations to the cluster

Azure Key Vault is a cloud service for securely storing and accessing secrets. A secret is anything that you want to tightly control access to, such as API keys, passwords, or certificates. Azure App Configuration is a managed service that helps developers centralize their application configurations. It provides a service to store, manage, and retrieve application settings and feature flags.

We can leverage these two services to store our application configurations and secrets and make them available to our workloads running in the AKS cluster.

Let's start by creating an Azure App Configuration store.

```bash
AC_NAME=$(az appconfig create --name myAppConfig$RANDOM --resource-group myResourceGroup --query name -o tsv)
```

It's best practice to create a User-Assigned Managed Identity to access the Azure App Configuration store. This way, you can control the access to the store and ensure that only the workloads that need access to the configurations can access them.

```bash
AC_ID=$(az identity create --name $AC_NAME-identity --resource-group myResourceGroup --query id -o tsv)
```

AKS offers an extension called the Azure App Configuratoin Provider for Kubernetes that allows you to sync configurations from Azure App Configuration to Kubernetes ConfigMaps. This extension is not installed by default but you can leverage the AKS Service Connector to install it.

In the Azure Portal, navigate to the AKS cluster and click on **Service Connector (Preview)** under the **Settings** section.

Click on the **+ Create** button to create a new Service Connector.

In the **Basics** tab, enter the following details:

- **Kubernetes namespace**: Enter `dev`
- **Service type**: Select **App Configuration**
- **Enable App Configuration extension on Kubernetes**: Check the box
- **Connection name**: Leave as default
- **App Configuration**: Select the Azure App Configuration store you created earlier

Click **Next: Authentication**

In the **Authentication** tab, leave **Workload Identity** selected, then select the **User-assigned managed identity** option and select the managed identity you created earlier.

Click **Next: Networking** then click **Next: Review + create** and finally click **Create** as soon as validation check has passed.

> [!NOTE]
> This can take up to 5 minutes to complete.

After the Service Connector has been created, you can verify that the Azure App Configuration Provider for Kubernetes extension has been installed in the AKS cluster.

```bash
kubectl get pods -n azappconfig-system
```

The Azure App Configuration Provider for Kubernetes extension also installed new Custom Resource Definitions (CRDs) which you can use to sync configurations from Azure App Configuration to Kubernetes ConfigMaps.

Before you deploy the sync configuration manifest, let's create some configurations that one of the applications will use.

```bash
az appconfig kv set --name $AC_NAME --key Key1 --value Value1 --yes
az appconfig kv set --name $AC_NAME --key Key2 --value Value2 --yes
az appconfig kv set --name $AC_NAME --key Key3 --value Value3 --yes
az appconfig kv set --name $AC_NAME --key Key4 --value Value4 --yes
az appconfig kv set --name $AC_NAME --key Key5 --value Value5 --yes
```

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
  name: myconfigs
spec:
  endpoint: $AC_ENDPOINT
  configuration:
    refresh:
      enabled: true
      interval: 10s
      monitoring:
        keyValues:
        - key: Key1
  target:
    configMapName: myconfigmap
  auth:
    workloadIdentity:
      serviceAccountName: $SA_NAME
EOF
```

After a minute or so, you can check to see if the configurations have been synced to the Kubernetes ConfigMap.

```bash
kubectl get cm -n dev myconfigmap -o jsonpath='{.data}' | jq
```

The app config sync is set to refresh every 10 seconds and you can choose which key to listen for changes. In this case, we are only listening for changes to the Key1 configuration. If you update the value for Key1 in the Azure App Configuration store, you should see the value updated in the Kubernetes ConfigMap after the next refresh.

Run the following command to update the value for Key1 in the Azure App Configuration store.

```bash
az appconfig kv set --name $AC_NAME --key Key1 --value NewValue1 --yes
```

After a minute or so, you can check to see if the configurations have been updated in the Kubernetes ConfigMap.

```bash
kubectl get cm -n dev myconfigmap -o jsonpath='{.data}' | jq
```

Great job! You have successfully synced configurations from Azure App Configuration to Kubernetes ConfigMaps.
